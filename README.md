<p align="center">
  <img alt="Quant72 AI" src="public/images/quant72_logo.jpg" width="200">
  <h1 align="center">Quant72 AI</h1>
</p>

<p align="center">
  Comprehensive Blockchain Data Analysis & Interaction Platform, providing quantitative trading, chain data analytics, and interactive blockchain engagement
</p>

<p align="center">
  <a href="#project-overview"><strong>Project Overview</strong></a> ·
  <a href="#key-features"><strong>Key Features</strong></a> ·
  <a href="#installation"><strong>Installation</strong></a> ·
  <a href="#usage-guide"><strong>Usage Guide</strong></a>
</p>
<br/>

## Project Overview

Quant72 AI is a comprehensive blockchain interaction and analytics platform that combines powerful AI technology with deep blockchain integration. The platform serves as a versatile assistant for accessing, analyzing, and interacting with on-chain data across multiple networks, enabling both detailed quantitative trading analysis and broader blockchain engagement.

Built on Next.js, the platform implements intelligent conversation functionality through AI SDK and connects directly to blockchain networks and APIs for real-time data access. Whether you're an experienced trader, blockchain developer, or crypto enthusiast, Quant72 AI provides an intuitive interface to complex blockchain operations through simple conversational commands.

## Key Features

### Quantitative Trading

- **Token Information Query** - Quickly retrieve token fundamentals through pool addresses
- **Real-time Price Data** - Get the latest token price, trading volume, and market cap information
- **K-line Technical Analysis** - Support for various time periods with technical indicators such as RSI, MACD, Bollinger Bands
- **Strategy Backtesting** - Test and evaluate trading strategies with performance metrics and optimization suggestions

### Chain Data Analytics

- **On-chain Activity Monitoring** - Track transactions, smart contract interactions, and protocol usage
- **Cross-chain Data Visualization** - Compare metrics across different blockchain networks
- **Smart Contract Analysis** - Examine contract code, interactions, and historical performance
- **DeFi Protocol Insights** - Analyze liquidity pools, yield farming opportunities, and protocol metrics

### Interactive Blockchain Interface

- **Conversational Access** - Interact with blockchains through natural language without technical barriers
- **Multi-chain Support** - Seamlessly access Base and multiple blockchain networks from a single interface
- **Wallet Management** - Check addresses and balances, transfer tokens, and manage digital assets conversationally
- **DeFi & NFT Operations** - Query Uniswap pools, request testnet funds, or mint NFTs through natural conversations

### AI-Assisted Analysis

- **Intelligent Conversation** - Communicate with the AI assistant using natural language to obtain insights and perform actions
- **Code Generation** - Assist in generating trading strategy code, analysis scripts, and smart contract interactions
- **Document Generation** - Automatically generate analysis reports, trading plans, and blockchain data summaries

## Installation

### Requirements

- Node.js 18.0.0 or higher
- pnpm package manager

### Local Setup

1. Clone the repository

```bash
git clone https://github.com/yourusername/quant72ai.git
cd quant72ai
```

2. Install dependencies

```bash
pnpm install
```

3. Configure environment variables

Copy the `.env.example` file and rename it to `.env`, then fill in the necessary environment variables:

```
AUTH_SECRET=your_auth_secret
# Other necessary API keys and configurations
```

4. Start the development server

```bash
pnpm dev
```

The application will run at [http://localhost:3000](http://localhost:3000).

## Usage Guide

### Token Analysis and Trading

1. Enter the token pool address in the chat interface
2. The AI assistant will automatically retrieve and analyze token information
3. View technical indicators and trend analysis results
4. Backtest strategies by specifying parameters such as time period, RSI values, and thresholds

### Blockchain Data Exploration

1. Request information about specific blockchain addresses, contracts, or protocols
2. Analyze transaction history, contract interactions, or protocol metrics
3. Compare data across different time periods or blockchain networks
4. Generate visualizations of on-chain activities and trends

### Blockchain Interaction

1. Connect your wallet or specify addresses for interaction
2. Issue conversational commands for token transfers, contract interactions, or NFT operations
3. Receive real-time confirmation and transaction details
4. Monitor transaction status and receive notifications upon completion

### Custom Analysis

1. Describe your analysis needs using natural language
2. The AI assistant will provide relevant analysis and recommendations based on your requirements
3. Request generation of custom reports, visualizations, or action plans

## Contribution Guidelines

We welcome issue reports and feature requests. If you want to contribute code, please follow these steps:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
