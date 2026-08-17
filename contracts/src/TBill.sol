// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title TBill
/// @notice Toy T-bill share. Not BlackRock. Not ERC-3643.
///
/// The asset the desk moves. It is a deliberately minimal token: a running total, a balance per
/// address, and a transfer. It is *not* a real ERC-20 — there is no `approve`, no `allowance`, and
/// `mint` is open to anyone. None of that matters here, because the only thing that ever holds or
/// moves a share is a `Desk`, and the desk's own rules are what the demo is about.
///
/// `decimals = 0` means shares are whole numbers. The whole clip moves exactly one.
contract TBill {
    string public constant name = "Sietch T-Bill Share (demo)";
    string public constant symbol = "sTBILL";
    uint8 public constant decimals = 0;

    /// @notice Total shares in existence.
    uint256 public totalSupply;
    /// @notice Shares held per address. Unknown addresses read as zero.
    mapping(address => uint256) public balanceOf;

    /// @notice Shares changed hands. A `from` of address(0) means they were newly minted.
    event Transfer(address indexed from, address indexed to, uint256 amount);

    /// @notice Create shares out of nothing and give them to `to`.
    /// @dev Unrestricted on purpose — this is demo scaffolding, called once per re-arm by
    /// `ClipFactory` to put a single share on a fresh desk.
    function mint(address to, uint256 amount) external {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    /// @notice Move shares from the caller to `to`.
    /// @return Always true when it succeeds; it reverts rather than returning false. `Desk.settle`
    /// still checks the return value, since a real token might report failure that way.
    function transfer(address to, uint256 amount) external returns (bool) {
        uint256 fromBal = balanceOf[msg.sender];
        require(fromBal >= amount, "balance");
        // Safe to skip overflow checks: the line above proves the subtraction cannot go negative,
        // and the addition cannot overflow without first minting more shares than `uint256` holds.
        unchecked {
            balanceOf[msg.sender] = fromBal - amount;
            balanceOf[to] += amount;
        }
        emit Transfer(msg.sender, to, amount);
        return true;
    }
}
