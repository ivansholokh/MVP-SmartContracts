pragma solidity ^0.4.15;

import "./StandardToken.sol";
import "./SafeMath.sol";

contract EtherSportGame is StandardToken {
    using SafeMath for uint256;

    /*
     *  Metadata
     */
    string public constant name = "Ether Sport Game";
    string public constant symbol = "ESCG";
    uint8 public constant decimals = 18;
    uint256 public constant tokenUnit = 10 ** uint256(decimals);

    /*
     *  Contract owner (Ethersport)
     */
    address public owner;

    mapping (address => bool) public lotters;
    uint256 public lastCreatedLine = 0;
    //===============================//0  1  2  3  4  5  6  7   8   9  10   11
    uint[] public distributionModel = [0, 0, 0, 0, 0, 0, 0, 8, 10, 15, 22, 100];
    event CreateLine(uint256 _lineId);
    struct Ticket {
        address ticketOwner;
        uint8[] bet;
    }
    struct Line {
        string[] pairs;
        bool[] canDraw;
        uint8[] winner;
        bool onSale;
        bool isFinished;
        uint ticketPriceESC;
        uint balance;
        uint ticketsLength;
        mapping (uint => Ticket) ticketsIndex;
    }
    mapping (uint256 => Line) lines;

    function getLinePairName(uint256 lineId, uint pairId) constant public returns(string) {
        return lines[lineId].pairs[pairId];
    }

    function getLinePairCanDraw(uint256 lineId, uint pairId) constant public returns(bool) {
        return lines[lineId].canDraw[pairId];
    }

    function getLinePairWinner(uint256 lineId, uint pairId) constant public returns(uint8) {
        return lines[lineId].winner[pairId];
    }

    function getLineIsFinished(uint256 lineId) constant public returns(bool) {
        return lines[lineId].isFinished;
    }

    function getLinePrice(uint256 lineId) constant public returns(uint) {
        return lines[lineId].ticketPriceESC;
    }

    function getLineBalance(uint256 lineId) constant public returns(uint) {
        return lines[lineId].balance;
    }

    function getLineTicketsLength(uint256 lineId) constant public returns(uint) {
        return lines[lineId].ticketsLength;
    }

    function getLineTicketAddressById(uint256 lineId, uint ticketId) constant public returns(address) {
        return lines[lineId].ticketsIndex[ticketId].ticketOwner;
    }

    function getLineTicketPairBet(uint256 lineId, uint ticketId, uint pairId) constant public returns(uint8) {
        return lines[lineId].ticketsIndex[ticketId].bet[pairId];
    }

    /*
     *  Hardware wallets
     */
    address public escMigrateFrom;  // Address for ETH owned by Ethersport

    /*
    *  Crowdsale parameters
    */
    bool public isStopped;
    uint256 public assignedSupply;  // Total ESC tokens currently assigned

    modifier onlyBy(address _account) {
        require(msg.sender == _account);
        _;
    }

    modifier onlyByLotter() {
        require(lotters[msg.sender]);
        _;
    }

    function changeOwner(address _newOwner) onlyBy(owner) external {
        owner = _newOwner;
    }

    modifier isValidState() {
        require(!isStopped);
        _;
    }

    /*
     *  Constructor
     */
    function EtherSportGame(
        address _escMigrateFrom
    )
    public
    {
        owner = msg.sender; // Creator of contract is owner
        escMigrateFrom = _escMigrateFrom;
        totalSupply    = 100 * (10**6) * tokenUnit;  // 100M total ESC tokens
        assignedSupply = 0;  // Set starting assigned supply to 0
    }

    /// @dev Fallback function can be used to buy tokens
    function () payable public {
        claimTokens();
    }

    /// @notice Create `msg.value` ETH worth of ESC
    function claimTokens() isValidState payable public {
        uint256 tokens = msg.value.mul(10000).div(100);
        balances[msg.sender] = balances[msg.sender].add(tokens);
        // As per ERC20 spec, a token contract which creates new tokens SHOULD trigger a Transfer event with the _from address
        // set to 0x0 when tokens are created (https://github.com/ethereum/EIPs/blob/master/EIPS/eip-20-token-standard.md)
        Transfer(0x0, msg.sender, tokens);
    }

    function grantLotter(address _lotter) onlyBy(owner) public {
        require(!lotters[_lotter]);
        lotters[_lotter] = true;
    }

    function revokeLotter(address _lotter) onlyBy(owner) public {
        require(lotters[_lotter]);
        lotters[_lotter] = false;
    }

    function initLinePair(uint id, string pair) internal {
        bytes memory b = bytes(pair);
        lines[lastCreatedLine].canDraw[id] = b[0] == '1';
        lines[lastCreatedLine].pairs[id] = pair;
    }

    // https://github.com/ethereum/solidity/issues/267
    //
    // It depends on how complex the expressions inside the function are,
    // but more than 16 local variables will not work. This story should fix it,
    // though: https://www.pivotaltracker.com/n/projects/1189488/stories/99085498

    function createLine(
        string pair0, string pair1, string pair2, string pair3, string pair4, string pair5, string pair6, string pair7, string pair8, string pair9, string pair10
    ) onlyByLotter() public {
        lastCreatedLine = lastCreatedLine + 1;
        string[] memory s = new string[](11);
        bool[] memory b = new bool[](11);
        uint8[] memory u = new uint8[](11);
        lines[lastCreatedLine] = Line(s, b, u, true, false, tokenUnit, 0, 0);
        initLinePair(0 , pair0 );
        initLinePair(1 , pair1 );
        initLinePair(2 , pair2 );
        initLinePair(3 , pair3 );
        initLinePair(4 , pair4 );
        initLinePair(5 , pair5 );
        initLinePair(6 , pair6 );
        initLinePair(7 , pair7 );
        initLinePair(8 , pair8 );
        initLinePair(9 , pair9 );
        initLinePair(10, pair10);
        CreateLine(lastCreatedLine);
    }

    function lineCloseSales(uint lineId) onlyByLotter() public {
        lines[lineId].onSale = false;
    }

    // winner: 0 = draw, 1 win team 1 (left), 2 win team 2 (right)
    function fillLinePairWinner(uint lineId, uint pairId, uint8 winner) internal {
        assert(lines[lineId].canDraw[pairId] || winner != 0);lines[lineId].winner[pairId] = winner;
    }

    function fillLineWithResults(
        uint lineId, uint8 pair0, uint8 pair1, uint8 pair2, uint8 pair3, uint8 pair4, uint8 pair5, uint8 pair6, uint8 pair7, uint8 pair8, uint8 pair9, uint8 pair10
    ) onlyByLotter() public {
        fillLinePairWinner(lineId, 0 , pair0 );
        fillLinePairWinner(lineId, 1 , pair1 );
        fillLinePairWinner(lineId, 2 , pair2 );
        fillLinePairWinner(lineId, 3 , pair3 );
        fillLinePairWinner(lineId, 4 , pair4 );
        fillLinePairWinner(lineId, 5 , pair5 );
        fillLinePairWinner(lineId, 6 , pair6 );
        fillLinePairWinner(lineId, 7 , pair7 );
        fillLinePairWinner(lineId, 8 , pair8 );
        fillLinePairWinner(lineId, 9 , pair9 );
        fillLinePairWinner(lineId, 10, pair10);
        lines[lineId].isFinished = true;
    }

    // winner: 0 = draw, 1 win team 1 (left), 2 win team 2 (right)
    function fillLinePairTicket(uint lineId, uint pairId, uint8 bet) internal {
        assert(lines[lineId].canDraw[pairId] || bet != 0);
        uint ticketId = lines[lineId].ticketsLength - 1;
        lines[lineId].ticketsIndex[ticketId].bet[pairId] = bet;
    }

    function updateTicketsIndex(uint lineId) internal {
        uint8[] memory b = new uint8[](11);
        uint ticketId = lines[lineId].ticketsLength;
        lines[lineId].ticketsIndex[ticketId] = Ticket(msg.sender, b);
        lines[lineId].ticketsIndex[ticketId].ticketOwner = msg.sender;
        lines[lineId].ticketsLength++;
    }

    function buyTicket (
        uint lineId, uint8 pair0, uint8 pair1, uint8 pair2, uint8 pair3, uint8 pair4, uint8 pair5, uint8 pair6, uint8 pair7, uint8 pair8, uint8 pair9, uint8 pair10
    ) public {
        require(lines[lineId].onSale);
        require(!lines[lineId].isFinished);
        require(balances[msg.sender] >= lines[lineId].ticketPriceESC);
        updateTicketsIndex(lineId);
        fillLinePairTicket(lineId, 0 , pair0 );
        fillLinePairTicket(lineId, 1 , pair1 );
        fillLinePairTicket(lineId, 2 , pair2 );
        fillLinePairTicket(lineId, 3 , pair3 );
        fillLinePairTicket(lineId, 4 , pair4 );
        fillLinePairTicket(lineId, 5 , pair5 );
        fillLinePairTicket(lineId, 6 , pair6 );
        fillLinePairTicket(lineId, 7 , pair7 );
        fillLinePairTicket(lineId, 8 , pair8 );
        fillLinePairTicket(lineId, 9 , pair9 );
        fillLinePairTicket(lineId, 10, pair10);
        uint ticketPrice = lines[lineId].ticketPriceESC;
        balances[msg.sender]    -= ticketPrice;
        balances[address(this)] += ticketPrice;
        lines[lineId].balance   += ticketPrice;
        Transfer(msg.sender, address(this), ticketPrice);
    }

    event WinnerLog(uint lineId, uint guessNumber, uint guessWinnerQty);
    event Winner(uint lineId, address winnerAddress, uint winnerPrize);
    event Log(string comment, uint data);
    mapping(uint => mapping(uint => address)) guessMap;

    function distributeWin (
        uint lineId
    ) public {
        //require(!lines[lineId].isFinished);
        require(lines[lastCreatedLine].ticketPriceESC > 0);
        uint guess;
        uint8[] memory guessQty = new uint8[](11);
        for (uint ticketId = 0; ticketId < lines[lineId].ticketsLength; ticketId++) {
            guess = 0;
            for (uint i = 0; i < 11; i++) {
                if(lines[lineId].winner[i] == lines[lineId].ticketsIndex[ticketId].bet[i]) {
                    guess++;
                    if(guess >= 7) {
                        guessMap[guess][guessQty[guess]] = lines[lineId].ticketsIndex[ticketId].ticketOwner;
                        guessQty[guess]++;
                    }
                }
            }
        }
        for(uint j = 7; j < 10; j++) {
            if(guessQty[j] > 0) {
                uint winTokens = lines[lineId].balance * distributionModel[j] / 100 / guessQty[j];
                //Log('winTokens', winTokens);
                for(uint k = 0; k < guessQty[j]; k++) {
                    balances[guessMap[j][k]] += winTokens;
                    balances[address(this)] -= winTokens;
                    Transfer(address(this), guessMap[j][k], winTokens);
                    Winner(lineId, guessMap[j][k], winTokens);
                }
            }
        }
    }
}