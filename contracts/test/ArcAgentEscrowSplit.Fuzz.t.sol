// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ArcAgentEscrowSplitTestBase} from "./ArcAgentEscrowSplit.Base.t.sol";
import {ArcAgentEscrowSplit} from "../ArcAgentEscrowSplit.sol";

contract ArcAgentEscrowSplitFuzzTest is ArcAgentEscrowSplitTestBase {

    // ── 18. Fuzz: split arithmetic ─────────────────────────────────────────────
    //
    // For any amount > 0 the three pieces must sum to amount exactly.
    // The contract computes:
    //   workerAmt   = (amount * 85) / 100
    //   verifierAmt = (amount * 10) / 100
    //   treasuryAmt = amount - workerAmt - verifierAmt   ← covers any rounding
    //
    // We bound amount to [1, type(uint128).max] to stay well within uint256 and
    // realistic USDC figures. We also execute the full flow end-to-end so the
    // test exercises the live contract arithmetic, not a Solidity mirror.

    function testFuzz_SplitArithmetic_SumsToAmount(uint256 amount) public {
        // Bound: at least 1, at most 1e30 (well within uint256, covers any precision)
        amount = bound(amount, 1, 1e30);

        // Create and submit the task using the fuzzed amount
        uint256 taskId = _createTask(amount, _deadline());
        _submitDeliverable(taskId);

        vm.prank(requester);
        escrow.approveAndSplit(taskId);

        uint256 workerAmt   = escrow.claimable(worker);
        uint256 verifierAmt = escrow.claimable(verifier);
        uint256 treasuryAmt = escrow.claimable(treasury);

        // Core invariant: parts must always sum to the total locked amount regardless of rounding
        assertEq(
            workerAmt + verifierAmt + treasuryAmt,
            amount,
            "split parts must sum to amount"
        );

        // Ordering only holds when there is no floor-to-zero at tiny amounts.
        // For amount >= 100, all three shares are strictly positive and worker >= verifier.
        if (amount >= 100) {
            assertGe(workerAmt,   verifierAmt, "worker share must be >= verifier share");
            assertGe(verifierAmt, treasuryAmt, "verifier share must be >= treasury share");
            assertGt(workerAmt, 0,   "worker share must be > 0 for amount >= 100");
            assertGt(verifierAmt, 0, "verifier share must be > 0 for amount >= 100");
            assertGt(treasuryAmt, 0, "treasury share must be > 0 for amount >= 100");
        }
    }

    // ── Additional fuzz: createTaskEscrow increments taskCount correctly ───────

    function testFuzz_TaskCountIncrements(uint8 n) public {
        // Create n tasks (n in [1, 20] to stay cheap)
        n = uint8(bound(n, 1, 20));

        for (uint256 i = 0; i < n; i++) {
            _createTask();
        }

        assertEq(escrow.taskCount(), n, "taskCount should equal number of tasks created");
    }

    // ── Additional fuzz: claimable balance is wiped after claim ───────────────

    function testFuzz_ClaimWipesClaimable(uint256 amount) public {
        // Bound to >= 100 so all three shares are non-zero after floor division
        // (for amount < 100, worker and verifier can have 0 claimable, making claim() revert —
        //  that is correct contract behaviour, covered by test_Revert_Claim_NothingToClaim_Stranger).
        amount = bound(amount, 100, 1e24);

        uint256 taskId = _createTask(amount, _deadline());
        _submitDeliverable(taskId);

        vm.prank(requester);
        escrow.approveAndSplit(taskId);

        uint256 workerAmt = escrow.claimable(worker);
        assertGt(workerAmt, 0, "worker claimable should be > 0 for amount >= 100");

        vm.prank(worker);
        escrow.claim();

        assertEq(escrow.claimable(worker), 0, "claimable must be zero after claim");
        assertEq(usdc.balanceOf(worker), workerAmt, "worker must receive exact claimable amount");
    }
}
