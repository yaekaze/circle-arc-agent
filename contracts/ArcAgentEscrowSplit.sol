// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract ArcAgentEscrowSplit is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum TaskStatus {
        Pending,
        Submitted,
        Settled,
        Refunded
    }

    struct Task {
        address requester;
        address worker;
        address verifier;
        bytes32 taskSpecHash;
        bytes32 deliverableHash;
        uint256 amount;
        uint64 deadline;
        TaskStatus status;
    }

    error ZeroAddress();
    error InvalidDeadline();
    error ZeroAmount();
    error InvalidTaskStatus();
    error Unauthorized();
    error DeadlineNotPassed();
    error DeadlinePassed();
    error NothingToClaim();
    error WorkerClaimTooEarly();

    event TaskCreated(
        uint256 indexed taskId,
        address indexed requester,
        address indexed worker,
        uint256 amount,
        uint64 deadline
    );
    event DeliverableSubmitted(
        uint256 indexed taskId,
        address indexed worker,
        bytes32 deliverableHash
    );
    event TaskSettled(
        uint256 indexed taskId,
        uint256 workerAmount,
        uint256 verifierAmount,
        uint256 treasuryAmount
    );
    event TaskRefunded(uint256 indexed taskId, address indexed requester, uint256 amount);
    event Claimed(address indexed recipient, uint256 amount);
    event WorkerClaimedTimeout(uint256 indexed taskId, address indexed worker);

    address public immutable usdcToken;
    address public immutable treasury;
    uint256 public taskCount;
    mapping(uint256 => Task) public tasks;
    mapping(address => uint256) public claimable;

    constructor(address _usdcToken, address _treasury) {
        if (_usdcToken == address(0) || _treasury == address(0)) revert ZeroAddress();

        usdcToken = _usdcToken;
        treasury = _treasury;
    }

    receive() external payable {
        revert();
    }

    fallback() external payable {
        revert();
    }

    function createTaskEscrow(
        address worker,
        address verifier,
        bytes32 taskSpecHash,
        uint64 deadline,
        uint256 amount
    ) external nonReentrant returns (uint256 taskId) {
        if (worker == address(0) || verifier == address(0)) revert ZeroAddress();
        if (deadline <= block.timestamp) revert InvalidDeadline();
        if (amount < 100) revert ZeroAmount(); // min 100 base units (0.0001 USDC) to avoid split dust

        IERC20(usdcToken).safeTransferFrom(msg.sender, address(this), amount);

        taskId = ++taskCount;
        tasks[taskId] = Task({
            requester: msg.sender,
            worker: worker,
            verifier: verifier,
            taskSpecHash: taskSpecHash,
            deliverableHash: bytes32(0),
            amount: amount,
            deadline: deadline,
            status: TaskStatus.Pending
        });

        emit TaskCreated(taskId, msg.sender, worker, amount, deadline);
    }

    function submitDeliverable(uint256 taskId, bytes32 deliverableHash) external {
        Task storage task = tasks[taskId];

        if (task.status != TaskStatus.Pending) revert InvalidTaskStatus();
        if (msg.sender != task.worker) revert Unauthorized();
        if (block.timestamp > task.deadline) revert DeadlinePassed();

        task.deliverableHash = deliverableHash;
        task.status = TaskStatus.Submitted;

        emit DeliverableSubmitted(taskId, msg.sender, deliverableHash);
    }

    function approveAndSplit(uint256 taskId) external nonReentrant {
        Task storage task = tasks[taskId];

        if (task.status != TaskStatus.Submitted) revert InvalidTaskStatus();
        if (msg.sender != task.requester && msg.sender != task.verifier) revert Unauthorized();

        uint256 workerAmount = (task.amount * 85) / 100;
        uint256 verifierAmount = (task.amount * 10) / 100;
        uint256 treasuryAmount = task.amount - workerAmount - verifierAmount;

        task.status = TaskStatus.Settled;

        claimable[task.worker] += workerAmount;
        claimable[task.verifier] += verifierAmount;
        claimable[treasury] += treasuryAmount;

        emit TaskSettled(taskId, workerAmount, verifierAmount, treasuryAmount);
    }

    function workerClaimAfterTimeout(uint256 taskId) external {
        Task storage task = tasks[taskId];

        if (msg.sender != task.worker) revert Unauthorized();
        if (task.status != TaskStatus.Submitted) revert InvalidTaskStatus();
        if (block.timestamp <= uint256(task.deadline) + 7 days) revert WorkerClaimTooEarly();

        uint256 workerAmount = (task.amount * 85) / 100;
        uint256 verifierAmount = (task.amount * 10) / 100;
        uint256 treasuryAmount = task.amount - workerAmount - verifierAmount;

        task.status = TaskStatus.Settled;

        claimable[task.worker] += workerAmount;
        claimable[task.verifier] += verifierAmount;
        claimable[treasury] += treasuryAmount;

        emit TaskSettled(taskId, workerAmount, verifierAmount, treasuryAmount);
        emit WorkerClaimedTimeout(taskId, task.worker);
    }

    function claim() external nonReentrant {
        uint256 amount = claimable[msg.sender];
        if (amount == 0) revert NothingToClaim();

        claimable[msg.sender] = 0;
        IERC20(usdcToken).safeTransfer(msg.sender, amount);

        emit Claimed(msg.sender, amount);
    }

    function reclaimExpired(uint256 taskId) external nonReentrant {
        Task storage task = tasks[taskId];

        if (task.status != TaskStatus.Pending) revert InvalidTaskStatus();
        if (block.timestamp <= task.deadline) revert DeadlineNotPassed();
        if (msg.sender != task.requester) revert Unauthorized();

        task.status = TaskStatus.Refunded;

        IERC20(usdcToken).safeTransfer(task.requester, task.amount);

        emit TaskRefunded(taskId, task.requester, task.amount);
    }
}
