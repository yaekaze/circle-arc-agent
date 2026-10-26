// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ArcAgentEscrowSplitTestBase} from "./ArcAgentEscrowSplit.Base.t.sol";
import {ArcAgentEscrowSplit} from "../ArcAgentEscrowSplit.sol";

contract ArcAgentEscrowSplitHappyPathTest is ArcAgentEscrowSplitTestBase {

    // ── 1. createTaskEscrow: locks USDC, emits TaskCreated ───────────────────

    function test_CreateTaskEscrow_LocksUSDCAndEmitsEvent() public {
        uint64 deadline = _deadline();
        usdc.mint(requester, AMOUNT);

        vm.startPrank(requester);
        usdc.approve(address(escrow), AMOUNT);

        vm.expectEmit(true, true, true, true, address(escrow));
        emit ArcAgentEscrowSplit.TaskCreated(1, requester, worker, AMOUNT, deadline);

        uint256 taskId = escrow.createTaskEscrow(worker, verifier, SPEC_HASH, deadline, AMOUNT);
        vm.stopPrank();

        assertEq(taskId, 1, "taskId should be 1");
        assertEq(escrow.taskCount(), 1, "taskCount should be 1");

        // USDC locked in escrow
        assertEq(usdc.balanceOf(address(escrow)), AMOUNT, "escrow should hold AMOUNT");
        assertEq(usdc.balanceOf(requester), 0, "requester balance should be 0 after lock");

        // Task fields
        (
            address r, address w, address v,
            bytes32 sh, bytes32 dh,
            uint256 amt, uint64 dl,
            ArcAgentEscrowSplit.TaskStatus status
        ) = escrow.tasks(taskId);

        assertEq(r,   requester,                     "requester mismatch");
        assertEq(w,   worker,                        "worker mismatch");
        assertEq(v,   verifier,                      "verifier mismatch");
        assertEq(sh,  SPEC_HASH,                     "specHash mismatch");
        assertEq(dh,  bytes32(0),                    "deliverableHash should be zero");
        assertEq(amt, AMOUNT,                        "amount mismatch");
        assertEq(dl,  deadline,                      "deadline mismatch");
        assertEq(uint8(status), uint8(ArcAgentEscrowSplit.TaskStatus.Pending), "status should be Pending");
    }

    // ── 2. submitDeliverable: sets hash, emits DeliverableSubmitted ──────────

    function test_SubmitDeliverable_SetsHashAndEmitsEvent() public {
        uint256 taskId = _createTask();

        vm.expectEmit(true, true, false, true, address(escrow));
        emit ArcAgentEscrowSplit.DeliverableSubmitted(taskId, worker, DELIV_HASH);

        vm.prank(worker);
        escrow.submitDeliverable(taskId, DELIV_HASH);

        (,,, , bytes32 dh,,, ArcAgentEscrowSplit.TaskStatus status) = escrow.tasks(taskId);
        assertEq(dh, DELIV_HASH, "deliverableHash mismatch");
        assertEq(uint8(status), uint8(ArcAgentEscrowSplit.TaskStatus.Submitted), "status should be Submitted");
    }

    // ── 3. approveAndSplit by requester: correct 85/10/5 split ───────────────

    function test_ApproveAndSplit_ByRequester_CorrectSplitAndEvent() public {
        uint256 taskId = _createAndSubmit();

        uint256 workerAmt   = (AMOUNT * 85) / 100;
        uint256 verifierAmt = (AMOUNT * 10) / 100;
        uint256 treasuryAmt = AMOUNT - workerAmt - verifierAmt;

        vm.expectEmit(true, false, false, true, address(escrow));
        emit ArcAgentEscrowSplit.TaskSettled(taskId, workerAmt, verifierAmt, treasuryAmt);

        vm.prank(requester);
        escrow.approveAndSplit(taskId);

        assertEq(escrow.claimable(worker),   workerAmt,   "worker claimable mismatch");
        assertEq(escrow.claimable(verifier), verifierAmt, "verifier claimable mismatch");
        assertEq(escrow.claimable(treasury), treasuryAmt, "treasury claimable mismatch");

        (,,,,,,, ArcAgentEscrowSplit.TaskStatus status) = escrow.tasks(taskId);
        assertEq(uint8(status), uint8(ArcAgentEscrowSplit.TaskStatus.Settled), "status should be Settled");
    }

    // ── 4. approveAndSplit by verifier: same result ───────────────────────────

    function test_ApproveAndSplit_ByVerifier_CorrectSplitAndEvent() public {
        uint256 taskId = _createAndSubmit();

        uint256 workerAmt   = (AMOUNT * 85) / 100;
        uint256 verifierAmt = (AMOUNT * 10) / 100;
        uint256 treasuryAmt = AMOUNT - workerAmt - verifierAmt;

        vm.expectEmit(true, false, false, true, address(escrow));
        emit ArcAgentEscrowSplit.TaskSettled(taskId, workerAmt, verifierAmt, treasuryAmt);

        vm.prank(verifier);
        escrow.approveAndSplit(taskId);

        assertEq(escrow.claimable(worker),   workerAmt,   "worker claimable mismatch");
        assertEq(escrow.claimable(verifier), verifierAmt, "verifier claimable mismatch");
        assertEq(escrow.claimable(treasury), treasuryAmt, "treasury claimable mismatch");
    }

    // ── 5. claim() by each party transfers USDC ──────────────────────────────

    function test_Claim_TransfersUSDCToEachParty() public {
        uint256 taskId = _createAndSubmit();
        vm.prank(requester);
        escrow.approveAndSplit(taskId);

        uint256 workerAmt   = (AMOUNT * 85) / 100;
        uint256 verifierAmt = (AMOUNT * 10) / 100;
        uint256 treasuryAmt = AMOUNT - workerAmt - verifierAmt;

        // Worker claims
        vm.expectEmit(true, false, false, true, address(escrow));
        emit ArcAgentEscrowSplit.Claimed(worker, workerAmt);
        vm.prank(worker);
        escrow.claim();
        assertEq(usdc.balanceOf(worker), workerAmt, "worker USDC balance mismatch after claim");
        assertEq(escrow.claimable(worker), 0, "worker claimable should be 0 after claim");

        // Verifier claims
        vm.expectEmit(true, false, false, true, address(escrow));
        emit ArcAgentEscrowSplit.Claimed(verifier, verifierAmt);
        vm.prank(verifier);
        escrow.claim();
        assertEq(usdc.balanceOf(verifier), verifierAmt, "verifier USDC balance mismatch after claim");
        assertEq(escrow.claimable(verifier), 0, "verifier claimable should be 0 after claim");

        // Treasury claims
        vm.expectEmit(true, false, false, true, address(escrow));
        emit ArcAgentEscrowSplit.Claimed(treasury, treasuryAmt);
        vm.prank(treasury);
        escrow.claim();
        assertEq(usdc.balanceOf(treasury), treasuryAmt, "treasury USDC balance mismatch after claim");
        assertEq(escrow.claimable(treasury), 0, "treasury claimable should be 0 after claim");

        // Escrow should be drained
        assertEq(usdc.balanceOf(address(escrow)), 0, "escrow should be drained after all claims");
    }

    // ── 6. reclaimExpired: refunds 100% after deadline ───────────────────────

    function test_ReclaimExpired_AfterDeadline_RefundsRequester() public {
        uint256 taskId = _createTask();

        // Warp past deadline
        vm.warp(block.timestamp + DURATION + 1);

        vm.expectEmit(true, true, false, true, address(escrow));
        emit ArcAgentEscrowSplit.TaskRefunded(taskId, requester, AMOUNT);

        vm.prank(requester);
        escrow.reclaimExpired(taskId);

        assertEq(usdc.balanceOf(requester), AMOUNT, "requester should get full refund");
        assertEq(usdc.balanceOf(address(escrow)), 0, "escrow should be empty after refund");

        (,,,,,,, ArcAgentEscrowSplit.TaskStatus status) = escrow.tasks(taskId);
        assertEq(uint8(status), uint8(ArcAgentEscrowSplit.TaskStatus.Refunded), "status should be Refunded");
    }

    // ── 7. workerClaimAfterTimeout: credits claimable after deadline + 7d ────

    function test_WorkerClaimAfterTimeout_AfterGracePeriod_CreditsAndEmits() public {
        uint256 taskId = _createAndSubmit();

        // Warp past deadline + 7 days (strictly greater than)
        vm.warp(block.timestamp + DURATION + 7 days + 1);

        uint256 workerAmt   = (AMOUNT * 85) / 100;
        uint256 verifierAmt = (AMOUNT * 10) / 100;
        uint256 treasuryAmt = AMOUNT - workerAmt - verifierAmt;

        vm.expectEmit(true, false, false, true, address(escrow));
        emit ArcAgentEscrowSplit.TaskSettled(taskId, workerAmt, verifierAmt, treasuryAmt);

        vm.expectEmit(true, true, false, false, address(escrow));
        emit ArcAgentEscrowSplit.WorkerClaimedTimeout(taskId, worker);

        vm.prank(worker);
        escrow.workerClaimAfterTimeout(taskId);

        assertEq(escrow.claimable(worker),   workerAmt,   "worker claimable mismatch after timeout");
        assertEq(escrow.claimable(verifier), verifierAmt, "verifier claimable mismatch after timeout");
        assertEq(escrow.claimable(treasury), treasuryAmt, "treasury claimable mismatch after timeout");

        (,,,,,,, ArcAgentEscrowSplit.TaskStatus status) = escrow.tasks(taskId);
        assertEq(uint8(status), uint8(ArcAgentEscrowSplit.TaskStatus.Settled), "status should be Settled");
    }
}
