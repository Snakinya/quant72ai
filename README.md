<p align="center">
  <img alt="Quant72 AI" src="public/quant72_logo.jpg" width="200">
  <h1 align="center">Quant72 AI</h1>
</p>

<p align="center">
  Blockchain-based Quantitative Trading AI Assistant, providing token analysis, technical indicator calculation, and strategy backtesting
</p>

<p align="center">
  <a href="#project-overview"><strong>Project Overview</strong></a> ·
  <a href="#key-features"><strong>Key Features</strong></a> ·
  <a href="#installation"><strong>Installation</strong></a> ·
  <a href="#usage-guide"><strong>Usage Guide</strong></a>
</p>
<br/>

## Project Overview

Quant72 AI is a blockchain-based quantitative trading AI assistant designed specifically for cryptocurrency traders and investors. The platform combines advanced AI technology with quantitative analysis tools to help users perform market analysis, token evaluation, and strategy backtesting, enabling more informed trading decisions.

Built on Next.js, the platform implements intelligent conversation functionality through AI SDK and obtains real-time market data via blockchain APIs. Whether you're an experienced trader or a cryptocurrency novice, Quant72 AI provides professional analytical support and trading recommendations.

## Key Features

### Token Information Query

- **Basic Token Information** - Quickly retrieve token fundamentals through pool addresses
- **Real-time Price Data** - Get the latest token price, trading volume, and market cap information
- **Liquidity Pool Analysis** - Analyze liquidity pool status and trading activity

### K-line Technical Analysis

- **Multi-period K-line Data** - Support for various time periods including 15 seconds, 1 minute, 5 minutes, 15 minutes, 1 hour, etc.
- **Technical Indicator Calculation** - Automatically calculate key technical indicators such as RSI, MACD, Bollinger Bands
- **Trend Analysis** - Intelligently identify market trends with confidence assessments
- **Visualization Charts** - Intuitively display price trends and technical indicators

### Strategy Backtesting

- **RSI Strategy Backtesting** - Backtest trading strategies based on RSI indicators
- **Performance Evaluation** - Calculate key metrics such as strategy returns, maximum drawdown, win rate
- **Transaction Records** - Detailed recording of entry and exit points for each trade
- **Strategy Optimization Suggestions** - Provide strategy improvement recommendations based on backtesting results

### AI-Assisted Analysis

- **Intelligent Conversation** - Communicate with the AI assistant using natural language to obtain market analysis and recommendations
- **Code Generation** - Assist in generating trading strategy code and analysis scripts
- **Document Generation** - Automatically generate analysis reports and trading plans

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

### Token Analysis

1. Enter the token pool address in the chat interface
2. The AI assistant will automatically retrieve and analyze token information
3. View technical indicators and trend analysis results

### Strategy Backtesting

1. Enter the backtesting command in the chat interface, for example: "Backtest RSI strategy using token address 0x..."
2. Specify backtesting parameters such as time period, RSI period, overbought/oversold thresholds
3. View backtesting results, including return rate, win rate, and transaction records

### Custom Analysis

1. Describe your analysis needs using natural language
2. The AI assistant will provide relevant analysis and recommendations based on your requirements
3. You can request generation of analysis reports or trading plans

## Contribution Guidelines

We welcome issue reports and feature requests. If you want to contribute code, please follow these steps:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
