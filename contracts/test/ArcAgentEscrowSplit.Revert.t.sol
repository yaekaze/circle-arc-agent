// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ArcAgentEscrowSplitTestBase} from "./ArcAgentEscrowSplit.Base.t.sol";
import {ArcAgentEscrowSplit} from "../ArcAgentEscrowSplit.sol";

contract ArcAgentEscrowSplitRevertTest is ArcAgentEscrowSplitTestBase {

    // ── 8. createTaskEscrow: zero worker → ZeroAddress ───────────────────────

    function test_Revert_CreateTask_ZeroWorker() public {
        usdc.mint(requester, AMOUNT);
        vm.startPrank(requester);
        usdc.approve(address(escrow), AMOUNT);
        vm.expectRevert(ArcAgentEscrowSplit.ZeroAddress.selector);
        escrow.createTaskEscrow(address(0), verifier, SPEC_HASH, _deadline(), AMOUNT);
        vm.stopPrank();
    }

    // zero verifier → ZeroAddress
    function test_Revert_CreateTask_ZeroVerifier() public {
        usdc.mint(requester, AMOUNT);
        vm.startPrank(requester);
        usdc.approve(address(escrow), AMOUNT);
        vm.expectRevert(ArcAgentEscrowSplit.ZeroAddress.selector);
        escrow.createTaskEscrow(worker, address(0), SPEC_HASH, _deadline(), AMOUNT);
        vm.stopPrank();
    }

    // ── 9. createTaskEscrow: deadline in the past → InvalidDeadline ──────────

    function test_Revert_CreateTask_DeadlineInPast() public {
        usdc.mint(requester, AMOUNT);
        vm.startPrank(requester);
        usdc.approve(address(escrow), AMOUNT);

        // deadline == block.timestamp (not strictly greater than) → invalid
        uint64 badDeadline = uint64(block.timestamp);
        vm.expectRevert(ArcAgentEscrowSplit.InvalidDeadline.selector);
        escrow.createTaskEscrow(worker, verifier, SPEC_HASH, badDeadline, AMOUNT);
        vm.stopPrank();
    }

    function test_Revert_CreateTask_DeadlineBeforePast() public {
        usdc.mint(requester, AMOUNT);
        vm.startPrank(requester);
        usdc.approve(address(escrow), AMOUNT);

        uint64 badDeadline = uint64(block.timestamp) - 1;
        vm.expectRevert(ArcAgentEscrowSplit.InvalidDeadline.selector);
        escrow.createTaskEscrow(worker, verifier, SPEC_HASH, badDeadline, AMOUNT);
        vm.stopPrank();
    }

    // ── 10. createTaskEscrow: zero amount → ZeroAmount ────────────────────────

    function test_Revert_CreateTask_ZeroAmount() public {
        vm.startPrank(requester);
        usdc.approve(address(escrow), 0);
        vm.expectRevert(ArcAgentEscrowSplit.ZeroAmount.selector);
        escrow.createTaskEscrow(worker, verifier, SPEC_HASH, _deadline(), 0);
        vm.stopPrank();
    }

    // ── 11. submitDeliverable: non-worker → Unauthorized ─────────────────────

    function test_Revert_SubmitDeliverable_NonWorker() public {
        uint256 taskId = _createTask();
        vm.prank(stranger);
        vm.expectRevert(ArcAgentEscrowSplit.Unauthorized.selector);
        escrow.submitDeliverable(taskId, DELIV_HASH);
    }

    // requester is also not the worker
    function test_Revert_SubmitDeliverable_RequesterCannotSubmit() public {
        uint256 taskId = _createTask();
        vm.prank(requester);
        vm.expectRevert(ArcAgentEscrowSplit.Unauthorized.selector);
        escrow.submitDeliverable(taskId, DELIV_HASH);
    }

    // ── 12. submitDeliverable: after deadline → DeadlinePassed ───────────────

    function test_Revert_SubmitDeliverable_AfterDeadline() public {
        uint256 taskId = _createTask();
        vm.warp(block.timestamp + DURATION + 1);
        vm.prank(worker);
        vm.expectRevert(ArcAgentEscrowSplit.DeadlinePassed.selector);
        escrow.submitDeliverable(taskId, DELIV_HASH);
    }

    // ── 13. approveAndSplit: stranger → Unauthorized ──────────────────────────

    function test_Revert_ApproveAndSplit_Stranger() public {
        uint256 taskId = _createAndSubmit();
        vm.prank(stranger);
        vm.expectRevert(ArcAgentEscrowSplit.Unauthorized.selector);
        escrow.approveAndSplit(taskId);
    }

    // worker (who is not requester/verifier) → Unauthorized
    function test_Revert_ApproveAndSplit_WorkerCannotApprove() public {
        uint256 taskId = _createAndSubmit();
        vm.prank(worker);
        vm.expectRevert(ArcAgentEscrowSplit.Unauthorized.selector);
        escrow.approveAndSplit(taskId);
    }

    // ── 14. approveAndSplit: Pending task (not Submitted) → InvalidTaskStatus ─

    function test_Revert_ApproveAndSplit_OnPendingTask() public {
        uint256 taskId = _createTask(); // status = Pending, not Submitted
        vm.prank(requester);
        vm.expectRevert(ArcAgentEscrowSplit.InvalidTaskStatus.selector);
        escrow.approveAndSplit(taskId);
    }

    // ── 15. reclaimExpired: before deadline → DeadlineNotPassed ──────────────

    function test_Revert_ReclaimExpired_BeforeDeadline() public {
        uint256 taskId = _createTask();
        // still before deadline
        vm.prank(requester);
        vm.expectRevert(ArcAgentEscrowSplit.DeadlineNotPassed.selector);
        escrow.reclaimExpired(taskId);
    }

    // exactly at deadline should also revert (contract uses <=)
    function test_Revert_ReclaimExpired_AtDeadline() public {
        uint256 taskId = _createTask();
        vm.warp(block.timestamp + DURATION); // warp to exactly the deadline
        vm.prank(requester);
        vm.expectRevert(ArcAgentEscrowSplit.DeadlineNotPassed.selector);
        escrow.reclaimExpired(taskId);
    }

    // ── 16. workerClaimAfterTimeout: before deadline + 7d → WorkerClaimTooEarly

    function test_Revert_WorkerClaimAfterTimeout_TooEarly() public {
        uint256 taskId = _createAndSubmit();
        // warp to exactly deadline + 7 days (contract requires strictly greater)
        vm.warp(block.timestamp + DURATION + 7 days);
        vm.prank(worker);
        vm.expectRevert(ArcAgentEscrowSplit.WorkerClaimTooEarly.selector);
        escrow.workerClaimAfterTimeout(taskId);
    }

    function test_Revert_WorkerClaimAfterTimeout_BeforeDeadline() public {
        uint256 taskId = _createAndSubmit();
        // still before deadline
        vm.prank(worker);
        vm.expectRevert(ArcAgentEscrowSplit.WorkerClaimTooEarly.selector);
        escrow.workerClaimAfterTimeout(taskId);
    }

    // ── 17. claim(): zero claimable → NothingToClaim ──────────────────────────

    function test_Revert_Claim_NothingToClaim_Stranger() public {
        vm.prank(stranger);
        vm.expectRevert(ArcAgentEscrowSplit.NothingToClaim.selector);
        escrow.claim();
    }

    // calling claim() twice: second call should revert
    function test_Revert_Claim_NothingToClaim_AfterAlreadyClaimed() public {
        uint256 taskId = _createAndSubmit();
        vm.prank(requester);
        escrow.approveAndSplit(taskId);

        vm.prank(worker);
        escrow.claim(); // first call succeeds

        vm.prank(worker);
        vm.expectRevert(ArcAgentEscrowSplit.NothingToClaim.selector);
        escrow.claim(); // second call must revert
    }
}
