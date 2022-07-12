require("@nomiclabs/hardhat-waffle")
require("@nomiclabs/hardhat-etherscan")
require("hardhat-deploy")
require("solidity-coverage")
require("hardhat-gas-reporter")
require("hardhat-contract-sizer")
require("dotenv").config()

module.exports = {
    solidity: "0.8.7",
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {
            chainId: 31337,
            blockConfirmations: 1,
        },
        rinkeby: {
            chainId: 4,
            url: process.env.RINKEBY_RPC_URL || "",
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
            blockConfirmations: 3,
            saveDeployments: true,
        },
        kovan: {
            chainId: 42,
            url: process.env.KOVAN_RPC_URL || "",
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
            blockConfirmations: 3,
            saveDeployments: true,
        },
    },
    namedAccounts: {
        deployer: {
            default: 0,
        },
        player: {
            default: 1,
        },
    },
    gasReporter: {
        enabled: false,
        outputFile: "gas-report.txt",
        noColors: true,
        currency: "USD",
        //coinmarketcap: process.env.COINMARKETCAP_API_KEY,
        //token: "ETH",
    },
    mocha: {
        // we set the maximum time a test can reach : 300 s
        timeout: 300000,
    },
    etherscan: {
        apiKey: {
            rinkeby: process.env.ETHERSCAN_API_KEY,
            kovan: process.env.ETHERSCAN_API_KEY,
        },
    },
}
