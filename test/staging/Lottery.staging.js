const { assert, expect } = require("chai")
const { network, deployments, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")

// We do unit test only on real chains, so for local/dev ones we skip
developmentChains.includes(network.name)
    ? describe.skip
    : describe("Lottery Unit Tests", function () {
          let lottery
          let deployer
          let lotteryEntranceFee
          const lotteryInterval = 30 // the one we choose in deploy

          beforeEach(async function () {
              const accounts = await ethers.getSigners()
              deployer = accounts[0]
              lottery = await ethers.getContract("Lottery", deployer)
              lotteryEntranceFee = await lottery.getEntranceFee()
          })

          // test the function that we execute after requesting a random winner
          describe("fulfillRandomWords", function () {
              it("works with live Chainlink Keepers and Chainlink VRF, we get a random winner", async () => {
                  // save the time for future references
                  console.log("Setting up test...")
                  const startingTimeStamp = await lottery.getLastTimeStamp()

                  // setup listener before we enter the lottery because in real chain we are not calling fucntions
                  // chainlink is calling function in a asyncronous way
                  await new Promise(async (resolve, reject) => {
                      lottery.once("WinnerPickedEvent", async () => {
                          try {
                              // Now lets get to the testing part, initialize param
                              const recentWinner = await lottery.getRecentWinner()
                              const lotteryState = await lottery.getLotteryState()
                              const numPlayers = await lottery.getNumPlayers()
                              const endingTimeStamp = await lottery.getLastTimeStamp()
                              const winnerEndingBalance = await deployer.getBalance()

                              // Check if they are correct
                              assert.equal(recentWinner.toString(), deployer.address)
                              assert.equal(lotteryState, "0")
                              assert.equal(numPlayers.toString(), "0")
                              assert(endingTimeStamp > startingTimeStamp)
                              assert.equal(
                                  winnerEndingBalance.toString(),
                                  winnerStartingBalance.add(lotteryEntranceFee).toString()
                              )
                          } catch (e) {
                              console.log(e)
                              reject(e)
                          }

                          // if try passes, resolves the promise
                          resolve()
                      })

                      // Then enter the lottery
                      console.log("Entering lottery...")
                      const tx = await lottery.enterLottery({ value: lotteryEntranceFee })
                      await tx.wait(1)
                      console.log("Ok, time to wait...")

                      // since we just make one enter we know who win
                      const winnerStartingBalance = await deployer.getBalance()
                  })
              })
          })
      })
