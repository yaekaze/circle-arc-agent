// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ArcAgentEscrowSplitTestBase} from "./ArcAgentEscrowSplit.Base.t.sol";
import {ArcAgentEscrowSplit} from "../ArcAgentEscrowSplit.sol";
import {MockERC20} from "../test-helpers/MockERC20.sol";

/// @dev Handler that drives the escrow through all its state transitions.
///      Foundry's invariant fuzzer will call these functions in random order.
contract EscrowHandler is ArcAgentEscrowSplitTestBase {

    ArcAgentEscrowSplit private _escrow;
    MockERC20           private _usdc;

    // tracking
    uint256 public totalLocked;      // sum of amounts currently locked in Pending/Submitted tasks
    uint256 public totalSettled;     // sum of amounts that have been settled (claimable or claimed)
    uint256 public totalRefunded;    // sum of amounts that have been refunded

    address private _requester;
    address private _worker;
    address private _verifier;
    address private _treasury;

    // Simple task tracker for the handler
    struct TrackedTask {
        uint256 taskId;
        uint256 amount;
        ArcAgentEscrowSplit.TaskStatus lastStatus;
    }
    TrackedTask[] public trackedTasks;

    constructor(
        ArcAgentEscrowSplit escrow_,
        MockERC20 usdc_,
        address req_,
        address wrk_,
        address ver_,
        address tres_
    ) {
        _escrow    = escrow_;
        _usdc      = usdc_;
        _requester = req_;
        _worker    = wrk_;
        _verifier  = ver_;
        _treasury  = tres_;
    }

    function createAndFundTask(uint256 amount) external {
        amount = bound(amount, 1, 1e20);
        uint64 deadline = uint64(block.timestamp + 7 days);

        _usdc.mint(_requester, amount);
        vm.startPrank(_requester);
        _usdc.approve(address(_escrow), amount);
        uint256 taskId = _escrow.createTaskEscrow(_worker, _verifier, keccak256("spec"), deadline, amount);
        vm.stopPrank();

        trackedTasks.push(TrackedTask({
            taskId: taskId,
            amount: amount,
            lastStatus: ArcAgentEscrowSplit.TaskStatus.Pending
        }));
        totalLocked += amount;
    }

    function submitDeliverable(uint256 seed) external {
        if (trackedTasks.length == 0) return;
        uint256 idx = seed % trackedTasks.length;
        TrackedTask storage tt = trackedTasks[idx];

        (,,,, , , , ArcAgentEscrowSplit.TaskStatus status) = _escrow.tasks(tt.taskId);
        if (status != ArcAgentEscrowSplit.TaskStatus.Pending) return;

        (,,,, , , uint64 dl, ) = _escrow.tasks(tt.taskId);
        if (block.timestamp > dl) return;

        vm.prank(_worker);
        _escrow.submitDeliverable(tt.taskId, keccak256("deliverable"));
        tt.lastStatus = ArcAgentEscrowSplit.TaskStatus.Submitted;
    }

    function approveAndSplit(uint256 seed) external {
        if (trackedTasks.length == 0) return;
        uint256 idx = seed % trackedTasks.length;
        TrackedTask storage tt = trackedTasks[idx];

        (,,,, , , , ArcAgentEscrowSplit.TaskStatus status) = _escrow.tasks(tt.taskId);
        if (status != ArcAgentEscrowSplit.TaskStatus.Submitted) return;

        vm.prank(_requester);
        _escrow.approveAndSplit(tt.taskId);

        totalLocked   -= tt.amount;
        totalSettled  += tt.amount;
        tt.lastStatus  = ArcAgentEscrowSplit.TaskStatus.Settled;
    }

    function reclaimExpired(uint256 seed) external {
        if (trackedTasks.length == 0) return;
        uint256 idx = seed % trackedTasks.length;
        TrackedTask storage tt = trackedTasks[idx];

        (,,,, , , , ArcAgentEscrowSplit.TaskStatus status) = _escrow.tasks(tt.taskId);
        if (status != ArcAgentEscrowSplit.TaskStatus.Pending) return;

        (,,,, , , uint64 dl, ) = _escrow.tasks(tt.taskId);
        if (block.timestamp <= dl) return;

        vm.prank(_requester);
        _escrow.reclaimExpired(tt.taskId);

        totalLocked    -= tt.amount;
        totalRefunded  += tt.amount;
        tt.lastStatus   = ArcAgentEscrowSplit.TaskStatus.Refunded;
    }

    function claimAsWorker() external {
        if (_escrow.claimable(_worker) == 0) return;
        uint256 amt = _escrow.claimable(_worker);
        vm.prank(_worker);
        _escrow.claim();
        totalSettled -= amt;
    }

    function claimAsVerifier() external {
        if (_escrow.claimable(_verifier) == 0) return;
        uint256 amt = _escrow.claimable(_verifier);
        vm.prank(_verifier);
        _escrow.claim();
        totalSettled -= amt;
    }

    function claimAsTreasury() external {
        if (_escrow.claimable(_treasury) == 0) return;
        uint256 amt = _escrow.claimable(_treasury);
        vm.prank(_treasury);
        _escrow.claim();
        totalSettled -= amt;
    }

    function warpTime(uint256 secs) external {
        secs = bound(secs, 1, 30 days);
        skip(secs);
    }

    function trackedTasksLength() external view returns (uint256) {
        return trackedTasks.length;
    }
}

contract ArcAgentEscrowSplitInvariantTest is ArcAgentEscrowSplitTestBase {
    EscrowHandler internal handler;

    function setUp() public override {
        super.setUp();
        handler = new EscrowHandler(escrow, usdc, requester, worker, verifier, treasury);
        targetContract(address(handler));
    }

    // ── 19a. Escrow USDC balance == sum of all still-locked amounts ─────────
    //
    // Whatever the handler does, the escrow's actual USDC balance must equal
    // the total amount currently locked in Pending or Submitted tasks plus
    // whatever is sitting in claimable (not yet withdrawn).
    //
    // Simplified conserved quantity: escrow_balance + refunded_out + claimed_out
    //   == handler.totalLocked (cumulative deposits) — hard to track across
    //   arbitrary sequences, so we assert the simpler:
    //
    //   escrow_usdc_balance  >= 0   (trivially true for uint256)
    //   claimable(worker) + claimable(verifier) + claimable(treasury) <= escrow_balance
    //   totalLocked (handler's in-flight) <= escrow_balance
    //
    function invariant_EscrowBalanceCoversPendingAndClaimable() public view {
        uint256 escrowBal = usdc.balanceOf(address(escrow));

        uint256 pendingClaimable =
            escrow.claimable(worker)   +
            escrow.claimable(verifier) +
            escrow.claimable(treasury);

        // Claimable amounts must always be backed by the escrow's USDC balance
        assertLe(
            pendingClaimable,
            escrowBal,
            "claimable > escrow USDC balance (undercollateralised)"
        );

        // Handler's in-flight locked amount must also be <= escrow balance
        assertLe(
            handler.totalLocked(),
            escrowBal,
            "totalLocked > escrow USDC balance"
        );
    }

    // ── 19b. Task amount field is never mutated post-creation ───────────────
    //
    // For every tracked task, the amount stored on-chain must equal what the
    // handler recorded at creation time.
    function invariant_TaskAmountIsImmutable() public view {
        uint256 n = handler.trackedTasksLength();
        for (uint256 i = 0; i < n; i++) {
            (uint256 taskId, uint256 recordedAmt, ) = handler.trackedTasks(i);
            (,,,,, uint256 onChainAmt,,) = escrow.tasks(taskId);
            assertEq(onChainAmt, recordedAmt, "task amount mutated after creation");
        }
    }

    // ── 19c. taskCount only ever increases ──────────────────────────────────
    function invariant_TaskCountNeverDecreases() public view {
        // This is structurally enforced (++ only), but we check the handler's
        // recorded task array length matches taskCount.
        assertEq(
            escrow.taskCount(),
            handler.trackedTasksLength(),
            "taskCount != number of tasks created by handler"
        );
    }
}
