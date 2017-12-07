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

}