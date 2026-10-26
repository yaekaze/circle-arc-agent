// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ArcAgentEscrowSplit} from "../ArcAgentEscrowSplit.sol";
import {MockERC20} from "../test-helpers/MockERC20.sol";

/// @dev Shared setup for all ArcAgentEscrowSplit test suites.
///      No test functions here — every category file inherits this.
abstract contract ArcAgentEscrowSplitTestBase is Test {
    // ── Actors ──────────────────────────────────────────────────────────────
    address internal requester = makeAddr("requester");
    address internal worker    = makeAddr("worker");
    address internal verifier  = makeAddr("verifier");
    address internal treasury  = makeAddr("treasury");
    address internal stranger  = makeAddr("stranger");

    // ── Constants ───────────────────────────────────────────────────────────
    uint256 internal constant AMOUNT       = 1_000e6;   // 1 000 USDC (6 dec)
    bytes32 internal constant SPEC_HASH    = keccak256("spec");
    bytes32 internal constant DELIV_HASH   = keccak256("deliverable");
    uint64  internal constant DURATION     = 7 days;    // deadline offset

    // ── Contracts ───────────────────────────────────────────────────────────
    MockERC20           internal usdc;
    ArcAgentEscrowSplit internal escrow;

    // ── Helpers ─────────────────────────────────────────────────────────────

    /// Absolute deadline used in most tests: current timestamp + DURATION.
    function _deadline() internal view returns (uint64) {
        return uint64(block.timestamp + DURATION);
    }

    /// Create a task as `requester` and return its taskId.
    function _createTask(uint256 amount, uint64 deadline) internal returns (uint256 taskId) {
        usdc.mint(requester, amount);
        vm.startPrank(requester);
        usdc.approve(address(escrow), amount);
        taskId = escrow.createTaskEscrow(worker, verifier, SPEC_HASH, deadline, amount);
        vm.stopPrank();
    }

    /// Create a task with default AMOUNT / deadline.
    function _createTask() internal returns (uint256 taskId) {
        return _createTask(AMOUNT, _deadline());
    }

    /// Submit a deliverable as `worker`.
    function _submitDeliverable(uint256 taskId) internal {
        vm.prank(worker);
        escrow.submitDeliverable(taskId, DELIV_HASH);
    }

    /// Create + submit in one call.
    function _createAndSubmit() internal returns (uint256 taskId) {
        taskId = _createTask();
        _submitDeliverable(taskId);
    }

    // ── setUp ────────────────────────────────────────────────────────────────
    function setUp() public virtual {
        usdc   = new MockERC20("Mock USDC", "mUSDC", 6);
        escrow = new ArcAgentEscrowSplit(address(usdc), treasury);
    }
}
