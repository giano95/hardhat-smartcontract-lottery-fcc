const { assert, expect } = require("chai")
const { network, deployments, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")

// We do unit test only on dev/local chains, so for real one we skip
!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Lottery Unit Tests", function () {
          let lottery
          let deployer
          let vrfCoordinatorV2Mock
          let lotteryEntranceFee
          const lotteryInterval = 30 // the one we choose in deploy

          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer // wallet of the deployer
              await deployments.fixture(["all"]) // deploy all the contracts
              lottery = await ethers.getContract("Lottery", deployer) // lottery contract
              vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer) // mock contract
              lotteryEntranceFee = await lottery.getEntranceFee() // entrance fee
          })

          // Test of the contructor function
          // TODO: finish this test
          describe("constructor", function () {
              it("initialize the lottery correctly", async () => {
                  // Assert that the lottery state is equal to 0 (OPEN)
                  const lotteryState = await lottery.getLotteryState()
                  assert.equal(lotteryState.toString(), "0")

                  // Assert that the lottery interval is equal to lotteryInterval
                  const lotteryInterval = await lottery.getLotteryInterval()
                  assert.equal(lotteryInterval.toString(), lotteryInterval)
              })
          })

          // Test the user trying to enter the lottery
          describe("enterLottery", function () {
              it("revert when the user doesn't send enough money (< entrance fee)", async () => {
                  sendValue = ethers.utils.parseEther("0.001") // the entrance fee is 0.01 ETH
                  await expect(lottery.enterLottery({ value: sendValue })).to.be.revertedWith(
                      "Lottery__ValueLowerThanEntranceFee"
                  )
              })

              it("add the user to the players array", async () => {
                  await lottery.enterLottery({ value: lotteryEntranceFee })
                  const playerAddress = await lottery.getPlayer(0)
                  assert.equal(playerAddress, deployer)
              })

              it("emits an event when user enter the lottery", async () => {
                  await expect(lottery.enterLottery({ value: lotteryEntranceFee }))
                      .to.emit(lottery, "enterLotteryEvent")
                      .withArgs(deployer)
              })

              it("doesn't allow entrance when lottery is calculating", async () => {
                  // We enter the lottery correctly
                  await lottery.enterLottery({ value: lotteryEntranceFee })

                  // increse the time of our local chain by interval + 1 so we can call performUpKeep correctly
                  await network.provider.send("evm_increaseTime", [lotteryInterval + 1])
                  await network.provider.request({ method: "evm_mine", params: [] })

                  // we pretend to be a keeper by calling it, in order to get CALCULATING state
                  await lottery.performUpkeep([])

                  // then we re-try to enter the lottery, and we check we can't do that because of the state
                  await expect(
                      lottery.enterLottery({ value: lotteryEntranceFee })
                  ).to.be.revertedWith("Lottery__LotteryNotOpen")
              })
          })

          // Test the checkUpKeep funtion
          describe("checkUpkeep", function () {
              // do everything exept sending money so basically only elapsing time
              it("returns false if people haven't sent any ETH", async () => {
                  // increse the time of our local chain by interval + 1
                  await network.provider.send("evm_increaseTime", [lotteryInterval + 1])
                  await network.provider.request({ method: "evm_mine", params: [] })

                  // callStatic simulate calling a function without actually creating a transaction
                  // so we can esaminate the output without creating a new block
                  const { upkeepNeeded } = await lottery.callStatic.checkUpkeep("0x")
                  assert(!upkeepNeeded)
              })

              // do everything right but change the state to CALCULATING
              it("returns false if lottery isn't open", async () => {
                  // We enter the lottery correctly
                  await lottery.enterLottery({ value: lotteryEntranceFee })

                  // increse the time of our local chain by interval + 1
                  await network.provider.send("evm_increaseTime", [lotteryInterval + 1])
                  await network.provider.request({ method: "evm_mine", params: [] })

                  // changes the state to calculating and store it
                  await lottery.performUpkeep([])
                  const lotteryState = await lottery.getLotteryState()

                  // callStatic simulate calling a function without actually creating a transaction
                  // so we can esaminate the output without creating a new block
                  const { upkeepNeeded } = await lottery.callStatic.checkUpkeep("0x")

                  // we assert that the state is changed to CALCULATING and that checkUpKeep return false
                  assert.equal(lotteryState.toString(), "1")
                  assert.equal(upkeepNeeded, false)
              })

              // similar to the ones before but with interval - 1
              it("returns false if enough time hasn't passed", async () => {
                  await lottery.enterLottery({ value: lotteryEntranceFee })
                  await network.provider.send("evm_increaseTime", [lotteryInterval - 1])
                  await network.provider.request({ method: "evm_mine", params: [] })
                  const { upkeepNeeded } = await lottery.callStatic.checkUpkeep("0x")
                  assert(!upkeepNeeded)
              })

              // similar to the ones before with everything right
              it("returns true if enough time has passed, has players, eth, and is open", async () => {
                  await lottery.enterLottery({ value: lotteryEntranceFee })
                  await network.provider.send("evm_increaseTime", [lotteryInterval + 1])
                  await network.provider.request({ method: "evm_mine", params: [] })
                  const { upkeepNeeded } = await lottery.callStatic.checkUpkeep("0x")
                  assert(upkeepNeeded)
              })
          })

          describe("performUpkeep", function () {
              // do everything right and then call performUpKeep
              it("can only run if checkupkeep is true", async () => {
                  await lottery.enterLottery({ value: lotteryEntranceFee })
                  await network.provider.send("evm_increaseTime", [lotteryInterval + 1])
                  await network.provider.request({ method: "evm_mine", params: [] })
                  const tx = await lottery.performUpkeep("0x")
                  assert(tx)
              })

              // just call performUpKeep without doing anything before
              it("reverts if checkup is false", async () => {
                  await expect(lottery.performUpkeep("0x")).to.be.revertedWith(
                      "Lottery__UpkeepNotNeeded"
                  )
              })

              it("updates the raffle state and emits a requestId", async () => {
                  await lottery.enterLottery({ value: lotteryEntranceFee })
                  await network.provider.send("evm_increaseTime", [lotteryInterval + 1])
                  await network.provider.request({ method: "evm_mine", params: [] })
                  const txResponse = await lottery.performUpkeep("0x") // emits requestId
                  const txReceipt = await txResponse.wait(1) // waits 1 block
                  const lotteryState = await lottery.getLotteryState() // updates state
                  const requestId = txReceipt.events[1].args.requestId
                  assert(requestId.toNumber() > 0)
                  assert(lotteryState == 1) // 0 = open, 1 = calculating
              })
          })
      })
