// SPDX-License-Identifier: MIT

pragma solidity ^0.8.7;

// Import Stuff
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/KeeperCompatible.sol";

// Error Codes
error Lottery__ValueLowerThanEntranceFee();
error Lottery__WinnerTransferFailed();
error Lottery__LotteryNotOpen();
error Lottery__UpkeepNotNeeded(
    uint256 timePassed,
    uint256 currentBalance,
    uint256 numPlayers,
    uint256 lotteryState
);

/**@title Smart Lottery Contract
 * @author Gianelli Marco
 * @notice This contract is for creating an untemperable decentralized lottery
 * @dev This implements the Chainlink VRF Version 2 and Chainlink Keepers
 */
contract Lottery is VRFConsumerBaseV2, KeeperCompatibleInterface {
    // Type Declarations
    enum LotteryState {
        OPEN,
        CALCULATING
    }

    // VRF Variables
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator; // The address of the Chainlink VRF Coordinator contract
    bytes32 private immutable i_keyHash; // The gas lane key hash value, which is the maximum gas price you are willing to pay for a request in wei
    uint64 private immutable i_subscriptionId; // The subscription ID that this contract uses for funding requests
    uint16 private immutable i_requestConfirmations; // How many confirmations the Chainlink node should wait before responding
    uint32 private immutable i_callbackGasLimit; // The limit for how much gas to use for the callback request to your contract's fulfillRandomWords() function
    uint32 private constant NUM_WORDS = 1; // How many random values to request

    // Keepers Variables
    uint256 private s_lastTimeStamp;

    // Lottery Variables
    uint256 private immutable i_entranceFee;
    address payable[] private s_players;
    address private s_recentWinner;
    LotteryState private s_lotteryState;
    uint256 private immutable i_lotteryInterval;

    // Events
    event enterLotteryEvent(address indexed player);
    event requestRandomWinnerEvent(uint256 requestId);
    event WinnerPickedEvent(address indexed player);

    constructor(
        uint256 entranceFee,
        address vrfCoordinator,
        bytes32 keyHash,
        uint64 subscriptionId,
        uint16 requestConfirmations,
        uint32 callbackGasLimit,
        uint256 lotteryInterval
    ) VRFConsumerBaseV2(vrfCoordinator) {
        i_entranceFee = entranceFee;
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinator);
        i_keyHash = keyHash;
        i_subscriptionId = subscriptionId;
        i_requestConfirmations = requestConfirmations;
        i_callbackGasLimit = callbackGasLimit;
        s_lotteryState = LotteryState.OPEN;
        s_lastTimeStamp = block.timestamp;
        i_lotteryInterval = lotteryInterval;
    }

    function enterLottery() public payable {
        if (msg.value < i_entranceFee) {
            revert Lottery__ValueLowerThanEntranceFee();
        }
        if (s_lotteryState != LotteryState.OPEN) {
            revert Lottery__LotteryNotOpen();
        }
        s_players.push(payable(msg.sender));

        emit enterLotteryEvent(msg.sender);
    }

    function fulfillRandomWords(
        uint256, /* requestId */
        uint256[] memory randomWords
    ) internal override {
        // Select the index of the winner using the module operator and save it
        uint256 indexOfWinner = randomWords[0] % s_players.length;
        address payable winner = s_players[indexOfWinner];
        s_recentWinner = winner;

        // Reset the player's array and the timestamp
        s_players = new address payable[](0);
        s_lastTimeStamp = block.timestamp;

        // Send money to the winner
        (bool success, ) = winner.call{value: address(this).balance}("");
        if (!success) {
            revert Lottery__WinnerTransferFailed();
        }

        // Update the state and finally emit the event
        s_lotteryState = LotteryState.OPEN;
        emit WinnerPickedEvent(winner);
    }

    /**
     * @dev This is the function that the Chainlink Keeper nodes call
     * looking for `upkeepNeeded` to return True. To return true we must
     * check this conditions:
     * 1. The time interval has passed between Lottery runs
     * 2. The lottery is open
     * 3. The contract have players
     * 4. The contract has ETH
     * 5. Implicity, your subscription is funded with LINK
     */
    function checkUpkeep(
        bytes calldata /* checkData */
    )
        public
        override
        returns (
            bool upkeepNeeded,
            bytes memory /* performData */
        )
    {
        upkeepNeeded = checkConditions();
    }

    function checkConditions() private view returns (bool) {
        bool timePassed = ((block.timestamp - s_lastTimeStamp) > i_lotteryInterval); // 1
        bool isOpen = s_lotteryState == LotteryState.OPEN; // 2
        bool hasPlayers = s_players.length > 0; // 3
        bool hasBalance = address(this).balance > 0; // 4

        return (timePassed && isOpen && hasBalance && hasPlayers);
    }

    // Request random winner
    function performUpkeep(
        bytes calldata /* performData */
    ) external override {
        // Check if this function is called by the checkUpKeep function or a possible attacker by re-checking the Conditions
        if (!checkConditions()) {
            revert Lottery__UpkeepNotNeeded(
                block.timestamp - s_lastTimeStamp,
                address(this).balance,
                s_players.length,
                uint256(s_lotteryState)
            );
        }

        // Update the state
        s_lotteryState = LotteryState.CALCULATING;

        // Request the random word
        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            i_keyHash,
            i_subscriptionId,
            i_requestConfirmations,
            i_callbackGasLimit,
            NUM_WORDS
        );
        emit requestRandomWinnerEvent(requestId);
    }

    // Getters
    function getLotteryState() public view returns (LotteryState) {
        return s_lotteryState;
    }

    function getEntranceFee() public view returns (uint256) {
        return i_entranceFee;
    }

    function getPlayer(uint256 index) public view returns (address) {
        return s_players[index];
    }

    function getRecentWinner() public view returns (address) {
        return s_recentWinner;
    }

    function getLastTimeStamp() public view returns (uint256) {
        return s_lastTimeStamp;
    }

    function getLotteryInterval() public view returns (uint256) {
        return i_lotteryInterval;
    }

    function getNumPlayers() public view returns (uint256) {
        return s_players.length;
    }
}
