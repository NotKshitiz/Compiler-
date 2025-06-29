# Blockchain Smart Contract Compiler

A browser-based compiler built in **JavaScript** for simulating smart contract logic with real-time blockchain metrics. Includes a custom lexer, parser, and semantic analysis phase, and connects to any Web3-compatible wallet using **Ethers.js**. Developers can fetch live data like gas prices, balances, and transaction history using the **Etherscan API**.

---

## Features

- Custom Lexer & Parser: Built from scratch to tokenize and parse a simple contract scripting language  
- Semantic Analysis: Performs meaning validation and logical interpretation of parsed code  
- Wallet Integration: Connect to any Web3-compatible wallet using `ethers.js`  
- Live Blockchain Data: Fetch balances, gas prices, and transactions using the Etherscan API  
- Dockerized: Easily run in isolated environments  
- CI/CD Ready: Jenkins pipelines for auto-build and deployment  

---

## Tech Stack

- Language: JavaScript  
- Blockchain API: Ethers.js, Etherscan API  
- Compiler Components: Lexer, Parser, Semantic Analyzer (custom-built)  
- DevOps: Docker, Jenkins  
- Web3: Wallet integration via provider injection  

---

## Demo

You can [view the source code here](https://github.com/NotKshitiz/Compiler-)

(Live version coming soon)

---

## How to Run Locally

```bash
git clone https://github.com/NotKshitiz/Compiler-.git
cd Compiler-


# To run locally (static)
open index.html

# OR using a simple dev server:
npx serve .
```
##  Author

**Kshitiz Kumar**  
B.Tech - Big Data @ UPES Dehradun  
GitHub: [@NotKshitiz](https://github.com/NotKshitiz)

##  License

MIT License
