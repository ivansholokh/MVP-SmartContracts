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
    event CreateLine(uint256 _lineId);
    struct Line {
        string[] pairs;
        bool[] canDraw;
    }
    mapping (uint256 => Line) lines;

    function getLinePairName(uint256 lineId, uint pairId) constant public returns(string) {
        return lines[lineId].pairs[pairId];
    }

    function getLinePairCanDraw(uint256 lineId, uint pairId) constant public returns(bool) {
        return lines[lineId].canDraw[pairId];
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

    modifier onlyBy(address _account){
        require(msg.sender == _account);
        _;
    }

    modifier onlyByLotter(){
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


    function  initLinePair(uint id, string pair) internal {
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
        string pair0,
        string pair1,
        string pair2,
        string pair3,
        string pair4,
        string pair5,
        string pair6,
        string pair7,
        string pair8,
        string pair9,
        string pair10
    ) onlyByLotter() public {
        lastCreatedLine = lastCreatedLine + 1;
        string[] memory s = new string[](11);
        bool[] memory b = new bool[](11);
        lines[lastCreatedLine] = Line(s, b);
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



}