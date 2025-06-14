const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const os = require('os');
const wabtPromise = require("wabt");
const app = express();
const { execSync } = require('child_process');
const archiver = require('archiver');
app.use(express.json());
app.use(cors());

// Alchemy configuration
const ALCHEMY_API_KEY = "8SIXXTX3pAv33W6XWk9bPM98RWASPlsx";  // Replace with your key

const NETWORKS = {
    "linea-sepolia": `https://linea-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
    
};
 

const providers = {};
for (const [network, rpcUrl] of Object.entries(NETWORKS)) {
    providers[network] = new ethers.JsonRpcProvider(rpcUrl);
}

class Lexer {
    constructor(input) {
        this.input = input;
        this.tokens = [];
        this.currentIndex = 0;
    }

    tokenize() {
        const blockchainFunctions = [
            "connectWallet", "contract", "setOwner", "getOwner", "isOwner", "destroyContract",
            "mintTokens", "transferTokens", "burnTokens", "balanceOf",
            "getBalance", "getGasPrice", "getBlockNumber",
            "getTransactionCount", "getChainId", "getNetworkName","getBalanceFan","sendETH","getTransactionStatus" ,"approve", "transferFrom", "getAllowance",
            "callContract", "getStorageAt",
            "signMessage", "verifySignature",
            "getBlock", "getTransactionReceipt", "getLogs",
            "getTokenDecimals", "getTokenSymbol","isValidAddress", "ethToWei", "weiToEth","getBlockTimestamp", "getLatestBlock","getPendingTransactions", "getNetworkLatency", "estimateGasExtended", "getCurrentDifficulty",
            "getUncleCount", "getGasLimit", "getPeers", "getHashRate", "getNonce",
            "getTransactionByHash", "getGasUsed", "getTokenTotalSupply", "getContractCode"
        ];

        const tokenPatterns = [
            { type: "KEYWORD", regex: new RegExp(blockchainFunctions.join("|")) },
            { type: "IDENTIFIER", regex: /[a-zA-Z_][a-zA-Z0-9_]*/ },
            { type: "NUMBER", regex: /-?\d+(?:\.\d+)?/ }, 
            { type: "STRING", regex: /"([^"]*)"/ },
            { type: "OPERATOR", regex: /=/ },
            { type: "DELIMITER", regex: /[(),;]/ },
            { type: "WHITESPACE", regex: /\s+/, ignore: true }
        ];

        while (this.currentIndex < this.input.length) {
            let match = null;
            for (let pattern of tokenPatterns) {
                const regex = new RegExp("^" + pattern.regex.source);
                match = this.input.substring(this.currentIndex).match(regex);
                if (match) {
                    if (!pattern.ignore) {
                        this.tokens.push({ type: pattern.type, value: match[0] });
                    }
                    this.currentIndex += match[0].length;
                    break;
                }
            }
            if (!match) {
                throw new Error(`Unexpected token at index ${this.currentIndex}`);
            }
        }
        return this.tokens;
    }
}

class Parser {
    constructor(tokens) {
        this.tokens = tokens;
        this.currentTokenIndex = 0;
    }

    parse() {
        const ast = [];
        while (this.currentTokenIndex < this.tokens.length) {
            // Skip redundant semicolons between statements
            while (this.getCurrentToken()?.value === ";") {
                this.currentTokenIndex++;
            }
            if (this.currentTokenIndex >= this.tokens.length) break;
            
            ast.push(this.parseStatement());
        }
        return ast;
    }
    parseStatement() {
        const token = this.getCurrentToken();
        
        if (token.type === "KEYWORD") {
            const functionCall = this.parseFunctionCall();
            
            // Optional semicolon handling
            if (this.getCurrentToken()?.value === ";") {
                this.eat("DELIMITER", ";");
            }
            
            return functionCall;
        }
        
        throw new Error(`Unexpected token: ${token.value}`);
    }


    parseFunctionCall() {
        const keyword = this.eat("KEYWORD");
        this.eat("DELIMITER", "(");
        
        const args = [];
        while (this.getCurrentToken().value !== ")") {
            const token = this.getCurrentToken();
            if (token.type === "STRING") {
                args.push(this.eat("STRING").value.replace(/"/g, ''));
            } else if (token.type === "NUMBER") {
                args.push(parseInt(this.eat("NUMBER").value));
            } else if (token.type === "IDENTIFIER") {
                args.push(this.eat("IDENTIFIER").value);
            }
            if (this.getCurrentToken().value === ",") {
                this.eat("DELIMITER", ",");
            }
        }
        this.eat("DELIMITER", ")");
        return { type: "FunctionCall", name: keyword.value, arguments: args };
    }

    eat(type, value = null) {
        const token = this.getCurrentToken();
        if (token.type !== type || (value !== null && token.value !== value)) {
            throw new Error(`Unexpected token: Expected ${type} but got ${token.value}`);
        }
        this.currentTokenIndex++;
        return token;
    }

    getCurrentToken() {
        return this.tokens[this.currentTokenIndex];
    }
}

const globalStorage = {};

class Interpreter {
    constructor() {
        this.storage = globalStorage;
        this.wallet = null;
        this.owner = null;
    }

    async execute(ast) {
        const output = [];
        for (const node of ast) {
            if (node.type === "FunctionCall") {
                output.push(await this.executeFunction(node));
            }
        }
        return output.join("\n");
    }

    async executeFunction(node) {
        switch (node.name) {
            // Wallet & Contract Functions
            case "connectWallet":
                return await this.connectWallet(node.arguments[0]);
            case "contract":
                return await this.deployContract(node.arguments[0]);
            case "setOwner":
                return this.setOwner(node.arguments[0]);
            case "getOwner":
                return this.getOwner();
            case "isOwner":
                return this.isOwner(node.arguments[0]);
            case "destroyContract":
                return this.destroyContract();

            // Token Functions
            case "mintTokens":
                return this.mintTokens(node.arguments[0], node.arguments[1]);
            case "transferTokens":
                return this.transferTokens(node.arguments[0], node.arguments[1], node.arguments[2]);
            case "burnTokens":
                return this.burnTokens(node.arguments[0], node.arguments[1]);
            case "balanceOf":
                return this.balanceOf(node.arguments[0]);

            // Blockchain Data Functions
            case "getBalance":
                return await this.getBalance(node.arguments[0]);
            case "getGasPrice":
                return await this.getGasPrice();
            case "getBlockNumber":
                return await this.getBlockNumber();
            case "getTransactionCount":
                return await this.getTransactionCount(node.arguments[0]);
            case "getChainId":
                return await this.getChainId();
            case "getNetworkName":
                return await this.getNetworkName();
            case "getBalanceFan":
                return await this.getBalanceFromAllNetworks(node.arguments[0]);
            case "sendETH":
                return await this.sendETH("linea-sepolia", node.arguments[0], node.arguments[1]);
            case "sendToken":
                    return await this.sendToken(node.arguments[0], node.arguments[1], node.arguments[2]);
            case "getTransactionStatus":
                    return await this.getTransactionStatus(node.arguments[0]);
            case "estimateGas":
                    return await this.estimateGas(node.arguments[0], node.arguments[1]);
            case "getTokenBalance":
                    return await this.getTokenBalance(node.arguments[0], node.arguments[1]);
            case "approve":
                    return this.approve(node.arguments[0], node.arguments[1], node.arguments[2]);
            case "transferFrom":
                    return this.transferFrom(node.arguments[0], node.arguments[1], node.arguments[2], node.arguments[3]);
            case "getAllowance":
                    return this.getAllowance(node.arguments[0], node.arguments[1]);
            case "callContract":
                    return await this.callContract(node.arguments[0], node.arguments[1], node.arguments[2], ...node.arguments.slice(3));
            case "getStorageAt":
                    return await this.getStorageAt(node.arguments[0], node.arguments[1]);
            case "signMessage":
                    return await this.signMessage(node.arguments[0]);
            case "verifySignature":
                    return this.verifySignature(node.arguments[0], node.arguments[1], node.arguments[2]);
            case "getBlock":
                    return await this.getBlock(node.arguments[0]);
            case "getTransactionReceipt":
                    return await this.getTransactionReceipt(node.arguments[0]);
            case "getLogs":
                    return await this.getLogs(node.arguments[0], node.arguments[1]);
            case "getTokenDecimals":
                    return await this.getTokenDecimals(node.arguments[0]);
            case "getTokenSymbol":
                    return await this.getTokenSymbol(node.arguments[0]);
             
            case "isValidAddress":
                    return this.isValidAddress(node.arguments[0]);
            case "ethToWei":
                    return this.ethToWei(node.arguments[0]);
            case "weiToEth":
                    return this.weiToEth(node.arguments[0]);
            case "getBlockTimestamp":
                    return await this.getBlockTimestamp(node.arguments[0]);
            case "getLatestBlock":
                    return await this.getLatestBlock();
                    case "getPendingTransactions":
                        return await this.getPendingTransactions();
                      case "getNetworkLatency":
                        return await this.getNetworkLatency();
                      case "getCurrentDifficulty":
                        return await this.getCurrentDifficulty();
                      case "getUncleCount":
                        return await this.getUncleCount(node.arguments[0]);
                      case "getGasLimit":
                        return await this.getGasLimit();
                      case "getPeers":
                        return await this.getPeers();
                      case "getHashRate":
                        return await this.getHashRate();
                      case "getNonce":
                        return await this.getNonce(node.arguments[0]);
                      case "getTransactionByHash":
                        return await this.getTransactionByHash(node.arguments[0]);
                      case "getGasUsed":
                        return await this.getGasUsed(node.arguments[0]);
                      case "getTokenTotalSupply":
                        return await this.getTokenTotalSupply(node.arguments[0]);
                      case "getContractCode":
                        return await this.getContractCode(node.arguments[0]);
            default:
                return `Unknown function: ${node.name}`;
        }
    }
    // 1. Address validation

    async getPendingTransactions() {
        try {
            const block = await providers["linea-sepolia"].send(
                "eth_getBlockByNumber", 
                ["pending", false]
            );
            return `Pending transactions: ${block.transactions.length}`;
        } catch (error) {
            return `Error: ${error.message}`;
        }
    }
    async getNetworkLatency() {
        try {
            const start = Date.now();
            await providers["linea-sepolia"].getBlockNumber();
            const latency = Date.now() - start;
            return `Network latency: ${latency}ms`;
        } catch (error) {
            return `Error: ${error.message}`;
        }
    }
    async getCurrentDifficulty() {
        try {
            const block = await providers["linea-sepolia"].getBlock("latest");
            return `Current difficulty: ${block.difficulty.toString()}`;
        } catch (error) {
            return `Error: ${error.message}`;
        }
    }
    async getUncleCount(blockParameter) {
        try {
            const block = await providers["linea-sepolia"].getBlock(
                blockParameter === "latest" ? "latest" : parseInt(blockParameter)
            );
            return `Uncle count: ${block.uncles.length}`;
        } catch (error) {
            return `Error: ${error.message}`;
        }
    }
    async getGasLimit() {
        try {
            const block = await providers["linea-sepolia"].getBlock("latest");
            return `Gas limit: ${block.gasLimit.toString()}`;
        } catch (error) {
            return `Error: ${error.message}`;
        }
    }async getPeers() {
        try {
            // Note: This may not work with all providers
            const peers = await providers["linea-sepolia"].send("net_peers", []);
            return `Connected peers: ${peers.length}`;
        } catch (error) {
            return `Error: ${error.message} (peer info may not be available)`;
        }
    }async getHashRate() {
        try {
            const hashrate = await providers["linea-sepolia"].send("eth_hashrate", []);
            return `Network hashrate: ${parseInt(hashrate)} H/s`;
        } catch (error) {
            return `Error: ${error.message}`;
        }
    } async getNonce(address) {
        try {
            const nonce = await providers["linea-sepolia"].getTransactionCount(
                address.replace(/"/g, ''),
                "pending"
            );
            return `Nonce for ${address}: ${nonce}`;
        } catch (error) {
            return `Error: ${error.message}`;
        }
    } async getTransactionByHash(hash) {
        try {
            const tx = await providers["linea-sepolia"].getTransaction(hash.replace(/"/g, ''));
            return tx ? 
                `Transaction:\nFrom: ${tx.from}\nTo: ${tx.to}\nValue: ${ethers.formatEther(tx.value)} ETH` :
                "Transaction not found";
        } catch (error) {
            return `Error: ${error.message}`;
        }
    }
    async getGasUsed(blockParameter) {
        try {
            const receipt = await providers["linea-sepolia"].getBlockReceipt(
                blockParameter === "latest" ? "latest" : parseInt(blockParameter)
            );
            return `Gas used: ${receipt.gasUsed.toString()}`;
        } catch (error) {
            return `Error: ${error.message}`;
        }
    } async getTokenTotalSupply(tokenAddress) {
        try {
            const abi = ["function totalSupply() view returns (uint256)"];
            const contract = new ethers.Contract(
                tokenAddress.replace(/"/g, ''),
                abi,
                providers["linea-sepolia"]
            );
            const supply = await contract.totalSupply();
            return `Total supply: ${ethers.formatUnits(supply, 18)}`;
        } catch (error) {
            return `Error: ${error.message}`;
        }
    }
 async getContractCode(address) {
        try {
            const code = await providers["linea-sepolia"].getCode(address.replace(/"/g, ''));
            return `Contract code: ${code.slice(0, 50)}... (${code.length} bytes)`;
        } catch (error) {
            return `Error: ${error.message}`;
        }
    }


isValidAddress(addressArg) {
    const address = addressArg.replace(/"/g, '');
    return ethers.isAddress(address) ? "Valid address" : "Invalid address";
}

// 2. ETH ↔ WEI conversion
ethToWei(amountArg) {
    const amount = parseFloat(amountArg);
    return `${amount} ETH = ${ethers.parseEther(amount.toString())} wei`;
}

weiToEth(amountArg) {
    const amount = parseFloat(amountArg);
    return `${amount} wei = ${ethers.formatEther(amount.toString())} ETH`;
}

async getBlockTimestamp(blockNumber) {
    try {
        console.log(`Fetching block ${blockNumber}...`);
        const block = await providers["linea-sepolia"].getBlock(blockNumber); //not working dont knwo why
        console.log("Block data:", block);
        if (!block) {
            return `Block not found`;
        }
        const timestamp = new Date(block.timestamp * 1000).toLocaleString();
        return `Block: ${blockNumber}\nTimestamp: ${timestamp}`;
    } catch (error) {
        console.error("Error in getBlockTimestamp:", error);
        return `Error fetching block timestamp: ${error.message}`;
    }
}


// 4. Latest block summary
async getLatestBlock() {
    try {
        const block = await providers["linea-sepolia"].getBlock("latest");
        return `Latest block:\nNumber: ${block.number}\nHash: ${block.hash}\nTransactions: ${block.transactions.length}`;
    } catch (error) {
        return `Error: ${error.message}`;
    }
}
    
    approve(ownerArg, spenderArg, amountArg) {
        const owner = ownerArg.replace(/"/g, '');
        const spender = spenderArg.replace(/"/g, '');
        const amount = parseFloat(amountArg);

        this.storage[owner] = this.storage[owner] || {};
        this.storage[owner][spender] = amount;

        return `Approved ${spender} to spend ${amount} tokens on behalf of ${owner}`;
    }

    transferFrom(spenderArg, fromArg, toArg, amountArg) {
        const spender = spenderArg.replace(/"/g, '');
        const from = fromArg.replace(/"/g, '');
        const to = toArg.replace(/"/g, '');
        const amount = parseFloat(amountArg);

        if ((this.storage[from]?.[spender] || 0) < amount) {
            return `Insufficient allowance for ${spender}`;
        }

        this.storage[from][spender] -= amount;
        this.storage[from].balance -= amount;
        this.storage[to].balance = (this.storage[to].balance || 0) + amount;

        return `Transferred ${amount} tokens from ${from} to ${to} via ${spender}`;
    }

    getAllowance(ownerArg, spenderArg) {
        const owner = ownerArg.replace(/"/g, '');
        const spender = spenderArg.replace(/"/g, '');

        return `Allowance for ${spender}: ${this.storage[owner]?.[spender] || 0}`;
    }
    async callContract(addressArg, abiJson, functionName, ...args) {
        try {
            const address = addressArg.replace(/"/g, '');
            const abi = JSON.parse(abiJson);
            const contract = new ethers.Contract(address, abi, this.wallet);
            const result = await contract[functionName](...args);
            return `Result: ${result.toString()}`;
        } catch (error) {
            return `Contract call failed: ${error.message}`;
        }
    }

    async getStorageAt(addressArg, positionArg) {
        try {
            const address = addressArg.replace(/"/g, '');
            const position = parseInt(positionArg);
            const value = await providers["linea-sepolia"].getStorage(address, position);
            return `Storage at position ${position}: ${value}`;
        } catch (error) {
            return `Storage read failed: ${error.message}`;
        }
    }

    async signMessage(messageArg) {
        try {
            const message = messageArg.replace(/"/g, '');
            if (!this.wallet) throw new Error("Connect wallet first");
            return await this.wallet.signMessage(message);
        } catch (error) {
            return `Signing failed: ${error.message}`;
        }
    }

    verifySignature(messageArg, signatureArg, addressArg) {
        try {
            const message = messageArg.replace(/"/g, '');
            const signature = signatureArg.replace(/"/g, '');
            const address = addressArg.replace(/"/g, '');

            const recoveredAddress = ethers.verifyMessage(message, signature);
            return recoveredAddress === address ? "Valid signature" : "Invalid signature";
        } catch (error) {
            return `Verification failed: ${error.message}`;
        }
    }
    async getBlock(blockNumberArg) {
        try {
            const blockNumber = parseInt(blockNumberArg);
            const block = await providers["linea-sepolia"].getBlock(blockNumber);
            return `Block ${blockNumber}: ${JSON.stringify(block, null, 2)}`;
        } catch (error) {
            return `Block fetch failed: ${error.message}`;
        }
    }

    async getTransactionReceipt(txHashArg) {
        try {
            const txHash = txHashArg.replace(/"/g, '');
            const receipt = await providers["linea-sepolia"].getTransactionReceipt(txHash);
            return `Receipt: ${JSON.stringify(receipt, null, 2)}`;
        } catch (error) {
            return `Receipt fetch failed: ${error.message}`;
        }
    }async getLogs(addressArg, topicsArg) {
        try {
            const address = addressArg.replace(/"/g, '');
            const topics = JSON.parse(topicsArg);
            const logs = await providers["linea-sepolia"].getLogs({ address, topics });
            return `Logs: ${JSON.stringify(logs, null, 2)}`;
        } catch (error) {
            return `Logs fetch failed: ${error.message}`;
        }
    }

    // 5️⃣ Token Metadata
    async getTokenDecimals(tokenAddressArg) {
        try {
            const tokenAddress = tokenAddressArg.replace(/"/g, '');
            const abi = ["function decimals() view returns (uint8)"];
            const contract = new ethers.Contract(tokenAddress, abi, providers["linea-sepolia"]);
            const decimals = await contract.decimals();
            return `Token decimals: ${decimals}`;
        } catch (error) {
            return `Decimals fetch failed: ${error.message}`;
        }
    } async getTokenSymbol(tokenAddressArg) {
        try {
            const tokenAddress = tokenAddressArg.replace(/"/g, '');
            const abi = ["function symbol() view returns (string)"];
            const contract = new ethers.Contract(tokenAddress, abi, providers["linea-sepolia"]);
            const symbol = await contract.symbol();
            return `Token symbol: ${symbol}`;
        } catch (error) {
            return `Symbol fetch failed: ${error.message}`;
        }
    }
    async connectWallet(privateKey) {
        try {
            privateKey = privateKey.replace(/"/g, '');
            this.wallet = new ethers.Wallet(privateKey, providers["linea-sepolia"]);
            const balance = await this.wallet.getBalance();
            return `Wallet connected: ${this.wallet.address}\nBalance: ${ethers.formatEther(balance)} ETH`;
        } catch (error) {
            return `Error connecting wallet: ${error.message}`;
        }
    }

    async deployContract(bytecodeArg) {
        try {
            if (!this.wallet) throw new Error("Connect wallet first");
            const bytecode = bytecodeArg.replace(/"/g, '');
            const tx = await this.wallet.sendTransaction({ data: bytecode });
            await tx.wait();
            return `Contract deployed at ${tx.creates}`;
        } catch (error) {
            return `Deployment failed: ${error.message}`;
        }
    }

    setOwner(addressArg) {
        const address = addressArg.replace(/"/g, '');
        this.owner = address;
        return `Owner set to ${address}`;
    }

    getOwner() {
        return this.owner ? `Owner: ${this.owner}` : "No owner set";
    }

    isOwner(addressArg) {
        const address = addressArg.replace(/"/g, '');
        if (!this.owner) return "No owner set";
        return this.owner === address ? "Address is owner" : "Address is not owner";
    }

    destroyContract() {
        if (!this.wallet || this.wallet.address !== this.owner) {
            return "Only owner can destroy contract";
        }
        this.storage = {};
        this.owner = null;
        return "Contract destroyed";
    }

    mintTokens(address, amount) {
        address = address.replace(/"/g, '');
        
        // Store balances in globalStorage
        this.storage[address] = (this.storage[address] || 0) + parseFloat(amount);

        console.log(`Balances after minting:`, this.storage);  // Debug line
        return `${amount} tokens minted for ${address}`;
    }

    transferTokens(fromArg, toArg, amountArg) {
        const from = fromArg.replace(/"/g, '');
        const to = toArg.replace(/"/g, '');
        const amount = parseFloat(amountArg);
        if (!this.storage[from] || this.storage[from] < amount) {
            return `Insufficient balance for ${from}`;
        }
        this.storage[from] -= amount;
        this.storage[to] = (this.storage[to] || 0) + amount;
        return `${amount} tokens transferred from ${from} to ${to}`;
    }

    burnTokens(addressArg, amountArg) {
        const address = addressArg.replace(/"/g, '');
        const amount = parseFloat(amountArg);
        if (!this.storage[address] || this.storage[address] < amount) {
            return `Insufficient tokens for ${address}`;
        }
        this.storage[address] -= amount;
        return `${amount} tokens burned from ${address}`;
    }

    balanceOf(address) {
        address = address.replace(/"/g, '');
        return `Balance of ${address}: ${this.storage[address] || 0}`;
    }

    async getBalance(address) {
        try {
            address = address.replace(/"/g, '');
            const balances = await this.getBalanceFromAllNetworks(address);
            return balances;
        } catch (error) {
            return `Error fetching balance: ${error.message}`;
        }
    }

    async getBalanceFromAllNetworks(address) {
        const results = [];
        for (const [network, provider] of Object.entries(providers)) {
            try {
                const balance = await provider.getBalance(address);
                results.push(`${network.toUpperCase()}: ${ethers.formatEther(balance)} ETH`);
            } catch (error) {
                results.push(`${network.toUpperCase()}: Error fetching balance`);
            }
        }
        return results.join("\n");
    }

    async getGasPrice() {
        const gasPrice = await providers["linea-sepolia"].getFeeData();
        return `Current gas price: ${ethers.formatUnits(gasPrice.gasPrice, "gwei")} GWEI`;
    }

    async getBlockNumber() {
        const blockNumber = await providers["linea-sepolia"].getBlockNumber();
        return `Current block number: ${blockNumber}`;
    }

    async getTransactionCount(addressArg) {
        try {
            const address = addressArg.replace(/"/g, '');
            const count = await providers["linea-sepolia"].getTransactionCount(address);
            return `Transaction count for ${address}: ${count}`;
        } catch (error) {
            return `Error fetching transaction count: ${error.message}`;
        }
    }

    async getChainId() {
        try {
            const network = await providers["linea-sepolia"].getNetwork();
            return `Chain ID: ${network.chainId}`;
        } catch (error) {
            return `Error fetching chain ID: ${error.message}`;
        }
    }

    async getNetworkName() {
        try {
            const network = await providers["linea-sepolia"].getNetwork();
            return `Network name: ${network.name}`;
        } catch (error) {
            return `Error fetching network name: ${error.message}`;
        }
    }
    async sendETH(networkArg, toArg, amountArg) {
        try {
            // Validate and clean inputs
            const network = networkArg.replace(/"/g, '');
            const to = toArg.replace(/"/g, '');
    
            // Ensure amount is a string
            const amount = ethers.parseEther(amountArg.toString());
    
            // Validate network
            if (!providers[network]) {
                throw new Error(`Network ${network} not supported`);
            }
    
            // Validate recipient address
            if (!ethers.isAddress(to)) {
                throw new Error(`Invalid recipient address: ${to}`);
            }
    
            // Send transaction
            const tx = await this.wallet.connect(providers[network]).sendTransaction({
                to: to,
                value: amount
            });
    
            return `Transaction sent: ${tx.hash}`;
        } catch (error) {
            return `Transfer failed: ${error.message}`;
        }
    }
    async sendToken(tokenAddressArg, toArg, amountArg) {
        try {
            const tokenAddress = tokenAddressArg.replace(/"/g, '');
            const to = toArg.replace(/"/g, '');
            const abi = ["function transfer(address to, uint256 amount)"];
            
            const contract = new ethers.Contract(tokenAddress, abi, this.wallet);
            const tx = await contract.transfer(to, ethers.parseUnits(amountArg, 18));
            
            return `Tokens sent: ${tx.hash}`;
        } catch (error) {
            return `Token transfer failed: ${error.message}`;
        }
    }

   // ✅ Add this function
async getTransactionStatus(txHash) {
    try {
        const receipt = await providers["linea-sepolia"].getTransactionReceipt(txHash);
        
        if (!receipt) {
            return `Transaction not yet mined or invalid hash`;
        }

        const status = receipt.status === 1 ? "Success" : "Failed";
        return `Transaction Status: ${status}\nBlock: ${receipt.blockNumber}\nGas Used: ${receipt.gasUsed.toString()}`;
    } catch (error) {
        return `Error fetching transaction status: ${error.message}`;
    }
}


    async estimateGas(toArg, amountArg) {
        try {
            const to = toArg.replace(/"/g, '');
            const amount = ethers.parseEther(amountArg.toString());
            
            const estimate = await providers["linea-sepolia"].estimateGas({
                to: to,
                value: amount
            });
            
            return `Estimated gas: ${estimate.toString()}`;
        } catch (error) {
            return `Estimation failed: ${error.message}`;
        }
    }

    async getTokenBalance(tokenAddressArg, addressArg) {
        try {
            const tokenAddress = tokenAddressArg.replace(/"/g, '');
            const address = addressArg.replace(/"/g, '');
            const abi = ["function balanceOf(address) view returns (uint256)"];
            
            const contract = new ethers.Contract(tokenAddress, abi, providers["linea-sepolia"]);
            const balance = await contract.balanceOf(address);
            
            return `Token balance: ${ethers.formatUnits(balance, 18)}`;
        } catch (error) {
            return `Balance check failed: ${error.message}`;
        }
    }
}

// Endpoint to run code (using Interpreter)
app.post('/run', async (req, res) => {
    try {
        const { code } = req.body;
        const lexer = new Lexer(code);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        const ast = parser.parse();
        const interpreter = new Interpreter();
        const result = await interpreter.execute(ast);
        res.json({ success: true, output: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});


app.post('/compile', async (req, res) => {
    try {
        const { code } = req.body;

        // 1. Create temporary files
        const tempDir = os.tmpdir();
        const tempJsPath = path.join(tempDir, `temp_${Date.now()}.js`);
        const exePath = path.join(tempDir, `app_${Date.now()}.exe`);
        const zipPath = path.join(tempDir, `compilation_${Date.now()}.zip`);

        // 2. Save JS code to temporary file
        fs.writeFileSync(tempJsPath, code);

        // 3. Compile to executable using pkg
        execSync(`pkg ${tempJsPath} --target node18-win-x64 -o ${exePath}`);

        // 4. Generate bytecode (hex representation)
        const bytecode = Buffer.from(code).toString('hex');

        // 5. Create zip archive
        const archive = archiver('zip', { zlib: { level: 9 } });
        const output = fs.createWriteStream(zipPath);

        archive.pipe(output);

        archive.append(fs.readFileSync(exePath), { name: 'application.exe' });
        archive.append(bytecode, { name: 'bytecode.evm' });
        archive.append(code, { name: 'source.chain' });

        await archive.finalize();

        output.on('close', () => {
            console.log(`Archive created: ${archive.pointer()} total bytes`);
            
            // Send the zip file for download
            res.download(zipPath, 'compilation.zip', (err) => {
                if (err) {
                    console.error('Error sending zip:', err);
                    res.status(500).send('Failed to download zip file');
                }
                
                // Clean up temp files after sending
                fs.unlinkSync(tempJsPath);
                fs.unlinkSync(exePath);
                fs.unlinkSync(zipPath);
            });
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            error: `Compilation failed: ${error.message}`
        });
    }
});
const PORT = 3000;
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'front.html'));
});
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
