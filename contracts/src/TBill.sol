// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Toy T-bill share. Not BlackRock. Not ERC-3643.
contract TBill {
    string public constant name = "Sietch T-Bill Share (demo)";
    string public constant symbol = "sTBILL";
    uint8 public constant decimals = 0;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;

    event Transfer(address indexed from, address indexed to, uint256 amount);

    function mint(address to, uint256 amount) external {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        uint256 fromBal = balanceOf[msg.sender];
        require(fromBal >= amount, "balance");
        unchecked {
            balanceOf[msg.sender] = fromBal - amount;
            balanceOf[to] += amount;
        }
        emit Transfer(msg.sender, to, amount);
        return true;
    }
}
