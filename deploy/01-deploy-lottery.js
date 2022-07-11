const { getNamedAccounts, deployments, network, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId

    // Initialize separatly the args that differ from real to local chain
    let vrfCoordinatorAddress, subscriptionId
    if (developmentChains.includes(network.name)) {
        // If we are on a development chain we take the vrf address from our mock
        const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
        vrfCoordinatorAddress = vrfCoordinatorV2Mock.address

        // Since we are on a local chain we create programatically a subscription
        // like we do on https://vrf.chain.link/rinkeby/
        const transactionResponse = await vrfCoordinatorV2Mock.createSubscription()
        const transactionReceipt = await transactionResponse.wait()
        subscriptionId = transactionReceipt.events[0].args.subId

        // Fund our sucbscription: mock makes it so we don't actually need funds in order to fund
        await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, ethers.utils.parseEther("10"))
    } else {
        // If we are on a real chain we take vrf adress and subscription ID from our help-hardhat-config
        vrfCoordinatorAddress = networkConfig[chainId][vrfCoordinatorAddress]
        subscriptionId = networkConfig[chainId]["subscriptionId"]
    }

    // Set the others args for the Lottery Contract
    const entranceFee = ethers.utils.parseEther("0.01")
    const keyHash = networkConfig[chainId]["keyHash"]
    const requestConfirmations = network.config.blockConfirmations
    const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"]
    const lotteryInterval = 30 // Since is not dependent to the network i prefer call it like this
    const args = [
        entranceFee,
        vrfCoordinatorAddress,
        keyHash,
        subscriptionId,
        requestConfirmations,
        callbackGasLimit,
        lotteryInterval,
    ]

    // Deploy the Lottery Contract
    const lottery = await deploy("Lottery", {
        from: deployer,
        log: true,
        waitConfirmations: requestConfirmations,
        args: args,
    })

    // Verify the Contract (only in real network)
    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("Verifying...")
        await verify(lottery.address, args)
    }
}

module.exports.tags = ["all", "lottery"]
