const _ = require('underscore')
const expectThrow = require('./utils').expectThrow
const EtherSportGame = artifacts.require('EtherSportGame')
const chalk = require('chalk')

let instance
let _startBlock
let _owner
let _lotter
let _escMigrateFrom
let _other
let _defaultBlockHeightDiff = [44800,    57600, 57867, 64267, 108954,    243018]
let _oneBlockHeightDiff = [1,    2, 2, 3, 4,    5]


const customContractFunctionCall = (_userAddress, _func, _funcData, _wei, asyncCallback) => new Promise((resolve, reject) => {
    const contractAbi = web3.eth.contract(instance.abi);
    const myContract = contractAbi.at(instance.address);
    //finally pass this data parameter to send Transaction
    console.log('going to', _funcData !== "___empty___" ? `call fn ${chalk.green(_func)} with args: `+JSON.stringify(_funcData) : 'send eth', chalk.grey(`${_userAddress} to ${instance.address}`));
    // suppose you want to call a function named myFunction of myContract
    let getData;
    if(_funcData === '___empty___') {
        getData = myContract[_func].getData();
    } else {
        getData = myContract[_func].getData(..._funcData)
    }

    web3.eth.sendTransaction({
        to: instance.address,
        from: _userAddress,
        data: getData,
        value: _wei,
        gas: 3000000
    }, async (err, transactionHash) => {
        asyncCallback(err, resolve, reject, transactionHash)
    });
})

const asyncBlank =  async (err, resolve, reject, transactionHash) => {
    if (err) return reject(err)
    resolve(transactionHash);
}
contract('EtherSportGame', function (accounts) {
    console.log('=contract EtherSport accounts:', accounts)

    _owner = accounts[0]
    _escMigrateFrom = accounts[1]
    _lotter = accounts[2]
    _other = accounts[3]

    beforeEach(async () => {
        instance = await EtherSportGame.new(accounts[1]);
    })

    describe('Contract creation:', () => {
        it('creation: check static data', async () => {
            let name      = await instance.name.call();
            let symbol    = await instance.symbol.call();
            let decimals  = await instance.decimals.call();
            let tokenUnit = await instance.tokenUnit.call();
            let owner = await instance.owner.call();
            let escMigrateFrom = await instance.escMigrateFrom.call();
            assert.strictEqual(name, "Ether Sport Game");
            assert.strictEqual(symbol, "ESCG");
            assert.strictEqual(decimals.toNumber(), 18);
            assert.strictEqual(+web3.fromWei(tokenUnit.toNumber()), 1); //The same as ether
            assert.strictEqual(owner, _owner); // We must be sure that owner set properly
            assert.strictEqual(escMigrateFrom, _escMigrateFrom);
        })
    })

    describe('Lotter permission:', () => {
        it('should ✅ successfully grant lotter permission', async () => {
            assert.deepEqual(await instance.lotters.call(_lotter), false, 'user should not have lotter role')
            await customContractFunctionCall(_owner, 'grantLotter', [_lotter] , 0, asyncBlank) // GRANT
            assert.deepEqual(await instance.lotters.call(_lotter), true, 'user should have lotter role')
            assert.deepEqual(await instance.lotters.call(_owner), false, 'user should not have lotter role')
        })
        it('should ✅ successfully revoke lotter permission', async () => {
            await customContractFunctionCall(_owner, 'grantLotter', [_lotter] , 0, asyncBlank)
            assert.deepEqual(await instance.lotters.call(_lotter), true, 'user should have lotter role')
            await customContractFunctionCall(_owner, 'revokeLotter', [_lotter] , 0, asyncBlank) //REVOKE
            assert.deepEqual(await instance.lotters.call(_lotter), false, 'user should not have lotter role')
        })
        it('should ❌ fail when not owner try to grant permission', async () => {
            return expectThrow(customContractFunctionCall(_lotter, 'grantLotter', [_lotter] , 0, asyncBlank)) // GRANT
        })
    })

    let validLine1 = [
       //00000000000000000000000000000000'
        '1Real Madrid - Barcelona',
        '0Bitcoin - Ethereum',
        '1Team 3.1 - Team 3.2',
        '1Team 4.1 - Team 4.2',
        '1Team 5.1 - Team 5.2',
        '1Team 6.1 - Team 6.2',
        '1Team 7.1 - Team 7.2',
        '1Team 8.1 - Team 8.2',
        '1Team 9.1 - Team 9.2',
        '1Team 10.1 - Team 10.2',
        '1Team 11.1 - Team 11.2'
        // bets deadline
        // distribution deadline => can be moved to finalise
    ]

    let validResultForLine1 = [
        0, // pair 0, draw (Madrid - Barcelona)
        1, // pair 1, win team 1 (Bitcoin)
        2, // pair 2, win team 2
        0, // pair 3, draw
        1, // pair 4, win team 1
        2, // pair 5, win team 2
        0, // pair 6, draw
        1, // pair 7, win team 1
        2, // pair 8, win team 2
        0, // pair 9, draw
        1, // pair 10, win team 1
    ]

    let invalidResultForLine1 = [
        0, // pair 0, draw (Madrid - Barcelona)
        0, // pair 1, !INVALID DRAW (Bitcoin - Ethereum)
        2, // pair 2, win team 2
        0, // pair 3, draw
        1, // pair 4, win team 1
        2, // pair 5, win team 2
        0, // pair 6, draw
        1, // pair 7, win team 1
        2, // pair 8, win team 2
        0, // pair 9, draw
        1, // pair 10, win team 1
    ]

    let one_esc = Math.pow(10,18);

    describe('Line creation:', () => {
        beforeEach(async () => {
            await customContractFunctionCall(_owner, 'grantLotter', [_lotter] , 0, asyncBlank) // GRANT
        })

        it('should ✅ successfully create line', async () => {
            let lastCreatedLine = +(await instance.lastCreatedLine.call());
            let txHash = await customContractFunctionCall(_lotter, 'createLine', validLine1, 0, asyncBlank);
            console.log(chalk.red(JSON.stringify(web3.eth.getTransactionReceipt(txHash).logs)));
            let lineNumber = +web3.eth.getTransactionReceipt(txHash).logs[0].data;
            assert.deepEqual(lineNumber, lastCreatedLine+1, 'ID should be 1');
            // line 1 pair 0
            let line1pair0name = await instance.getLinePairName.call(lineNumber, 0)
            console.log(`line1: ${JSON.stringify(line1pair0name)}`)
            let line1pair0draw = await instance.getLinePairCanDraw.call(lineNumber, 0)
            console.log(`line1: ${JSON.stringify(line1pair0draw)}`)
            assert.deepEqual(line1pair0name, validLine1[0], 'line 1 pair 0 name')
            assert.deepEqual(line1pair0draw, !!+validLine1[0][0], 'line 1 pair 0 canDraw')
            // line 1 pair 1
            let line1pair1name = await instance.getLinePairName.call(lineNumber, 1)
            console.log(`line1: ${JSON.stringify(line1pair1name)}`)
            let line1pair1draw = await instance.getLinePairCanDraw.call(lineNumber, 1)
            console.log(`line1: ${JSON.stringify(line1pair1draw)}`)
            assert.deepEqual(line1pair1name, validLine1[1], `line 1 pair 1 name ${validLine1[1]}`)
            assert.deepEqual(line1pair1draw, !!+validLine1[1][0], `line 1 pair 1 canDraw ${validLine1[1]} ${!!validLine1[1][0]}`)

        });

        it.skip('should ❌ fail create line without 11 events', () => {})
        it.skip('should ❌ fail create line with more than 11 events', () => {})
        it.skip('should ❌ fail create line if user has no lotter role', () => {})
    })

    describe.skip('Set line additional data', () => {
        let lineNumber

        beforeEach(async () => {
            await customContractFunctionCall(_owner, 'grantLotter', [_lotter] , 0, asyncBlank) // GRANT
            let txHash = await customContractFunctionCall(_lotter, 'createLine', validLine1, 0, asyncBlank);
            lineNumber = +web3.eth.getTransactionReceipt(txHash).logs[0].data;
        })
    })

    describe('Line filling with results:', () => {
        let lineNumber

        beforeEach(async () => {
            await customContractFunctionCall(_owner, 'grantLotter', [_lotter] , 0, asyncBlank) // GRANT
            let txHash = await customContractFunctionCall(_lotter, 'createLine', validLine1, 0, asyncBlank);
            lineNumber = +web3.eth.getTransactionReceipt(txHash).logs[0].data;
        })

        it('should ✅ successfully fill line with results', async () => {
            await customContractFunctionCall(_lotter, 'fillLineWithResults', [lineNumber, ...validResultForLine1], 0, asyncBlank);
            // line 1 pair 0
            let line1pair0name = await instance.getLinePairName.call(lineNumber, 0)
            console.log(`line1 pair: ${JSON.stringify(line1pair0name)}`)
            let line1pair0draw = await instance.getLinePairCanDraw.call(lineNumber, 0)
            console.log(`line1 canDraw: ${JSON.stringify(line1pair0draw)}`)
            let line1pair0winner = +(await instance.getLinePairWinner.call(lineNumber, 0))
            console.log(`line1 winner: ${JSON.stringify(line1pair0winner)}`)
            assert.deepEqual(line1pair0name, validLine1[0], 'line 1 pair 0 name')
            assert.deepEqual(line1pair0draw, !!+validLine1[0][0], 'line 1 pair 0 canDraw')
            assert.deepEqual(line1pair0winner, +validResultForLine1[0], 'line 1 pair 0 winner')

        })
        it.skip('should ❌ fail fill line with results with wrong permission', () => {})
        it.skip('should ❌ fail fill line with results before last event finish', () => {})
        it.skip('should ❌ fail fill line with results it already filled', () => {})
        it.skip('should ❌ fail fill line with results with incorrect result', () => {})
        it.skip('should ❌ fail fill line with results with incorrect arguments number', () => {})
    })

    describe.skip('Line distribute prize:', () => {
        it('should ✅ successfully for 1 winner', () => {})
        it('should ✅ successfully for few winners for same prize', () => {})
        it('should ✅ successfully for many winners for many prizes', () => {})
        it('should ❌ fail', () => {})
    })

    describe.skip('Sell esc:', () => {
        it('should ✅ successfully set esc to sale', () => {})
        it('should ✅ successfully remove esc from sale', () => {})
        it('should ✅ successfully got eth for selled esc', () => {})
        it('should ✅ successfully buy esc', () => {})
        it('should ❌ fail', () => {})
    })

    describe('Buy ticket', () => {
        let lineNumber

        beforeEach(async () => {
            await customContractFunctionCall(_owner, 'grantLotter', [_lotter] , 0, asyncBlank) // GRANT
            await customContractFunctionCall(_other, 'claimTokens', '___empty___', web3.toWei(1), asyncBlank);
            let txHash = await customContractFunctionCall(_lotter, 'createLine', validLine1, 0, asyncBlank);
            lineNumber = +web3.eth.getTransactionReceipt(txHash).logs[0].data;
        })

        it('should ✅ successfully but ticket for esc', async () => {
            let contractESCBalanceBefore = await instance.balanceOf.call(instance.address);
            let otherESCBalanceBefore = await instance.balanceOf.call(_other);
            console.log(`contractESCBalance ${contractESCBalanceBefore}, otherESCBalance ${otherESCBalanceBefore}`)
            let txHash = await customContractFunctionCall(_other, 'buyTicket', [lineNumber, ...validResultForLine1], 0, asyncBlank);
            console.log(chalk.blue(JSON.stringify(web3.eth.getTransactionReceipt(txHash).logs)));
            let line1pair0name = await instance.getLinePairName.call(lineNumber, 0)
            console.log(`line1 pair: ${JSON.stringify(line1pair0name)}`)
            let line1pair0draw = await instance.getLinePairCanDraw.call(lineNumber, 0)
            console.log(`line1 canDraw: ${JSON.stringify(line1pair0draw)}`)
            let line1pair0bet = +(await instance.getLineTicketPairBet.call(lineNumber, _other ,0))
            console.log(`line1 bet: ${JSON.stringify(line1pair0bet)}`)
            let line1balance = +(await instance.getLineBalance.call(lineNumber))
            console.log(`line1 balance: ${JSON.stringify(line1balance)}`)

            let ticketsLength = +(await instance.getLineTicketsLength.call(lineNumber));
            let getLineTicketAddressById = await instance.getLineTicketAddressById.call(lineNumber, ticketsLength-1)
            console.log(`ticketsLength ${ticketsLength}, getLineTicketAddressById ${getLineTicketAddressById}`)
            assert.deepEqual(getLineTicketAddressById, _other, 'check address')

            //Check balances
            let contractESCBalance = await instance.balanceOf.call(instance.address);
            let otherESCBalance = await instance.balanceOf.call(_other);
            console.log(`contractESCBalance ${contractESCBalance}, otherESCBalance ${otherESCBalance}`)
            assert.deepEqual(contractESCBalance - contractESCBalanceBefore, one_esc, 'contract balance diff')
            assert.deepEqual(otherESCBalanceBefore - otherESCBalance, one_esc, 'player balance diff')
            assert.deepEqual(line1balance, one_esc, 'line balance')
        })
        it('should ✅ successfully', () => {})
        it('should ❌ fail', () => {})
    })

    describe.skip('...:', () => {
        it('should ✅ successfully', () => {})
        it('should ❌ fail', () => {})
    })

    describe.skip('Old tests', () => {
        it('creation: should fail if start block already minded', async () => {
            return expectThrow(EtherSport.new(accounts[1],1, ..._defaultBlockHeightDiff));
        })

        it('creation: should fail if fund address is 0x0', async () => {
            return expectThrow(EtherSport.new(0x0,100000, ..._defaultBlockHeightDiff));
        })

        it('stopSale: should stop sale if contact creator ask', async () => {
            let isStopped = await instance.isStopped.call();
            assert.strictEqual(isStopped, false)
            return customContractFunctionCall(_owner, 'stopSale', '___empty___', 0,
                async (err, resolve, reject) => {
                    if (err) return reject(err)
                    let isStopped = await instance.isStopped.call();
                    assert.strictEqual(isStopped, true)
                    resolve();
                }
            )
        })

        it('stopSale: should not stop sale if any person ask(not creator)', async () => {
            let isStopped = await instance.isStopped.call();
            assert.strictEqual(isStopped, false)
            return expectThrow(customContractFunctionCall(_other, 'stopSale', '___empty___', 0, asyncBlank))
        })

        it('stopSale: should restart sale if contact creator ask', async () => {
            let isStopped = await instance.isStopped.call();
            assert.strictEqual(isStopped, false)
            return customContractFunctionCall(_owner, 'stopSale', '___empty___', 0,
                async (err, resolve, reject) => {
                    if (err) return reject(err)
                    let isStopped = await instance.isStopped.call();
                    assert.strictEqual(isStopped, true)
                    await customContractFunctionCall(_owner, 'restartSale', '___empty___', 0,
                        async (err, resolve, reject) => {
                            if (err) return reject(err)
                            let isStopped = await instance.isStopped.call();
                            assert.strictEqual(isStopped, false)
                            resolve()
                        }
                    )
                    resolve()
                }
            )
        })

        it('stopSale: should restart sale if any person ask(not creator)', async () => {
            let isStopped = await instance.isStopped.call();
            assert.strictEqual(isStopped, false)
            return customContractFunctionCall(_owner, 'stopSale', '___empty___', 0,
                async (err, resolve, reject) => {
                    if (err) return reject(err)
                    let isStopped = await instance.isStopped.call();
                    assert.strictEqual(isStopped, true)
                    await expectThrow(customContractFunctionCall(_other, 'restartSale', '___empty___', 0, asyncBlank))
                    resolve()
                }
            )
        })

        it('changeOwner: should change owner of contract', async () => {
            return customContractFunctionCall(_owner, 'changeOwner', [_other], 0,
                async (err, resolve, reject) => {
                    if (err) return reject(err)
                    let owner = await instance.owner.call();
                    assert.strictEqual(owner, _other); // We must be sure that owner set properly
                    resolve();
                }
            )
        })

        it('claimTokens: should reject payment under min payment value', async () => {
            return expectThrow(customContractFunctionCall(_other, 'claimTokens', '___empty___', 1, asyncBlank))
        })

        it('claimTokens: should purchases tokens', async () => {
            return customContractFunctionCall(_other, 'claimTokens', '___empty___',
                web3.toWei(1),
                async (err, resolve, reject) => {
                    if (err) return reject(err)
                    let _otherBalance = await instance.balanceOf.call(_other);
                    assert.strictEqual(+web3.fromWei(_otherBalance), 2000); // We must be sure that owner set properly
                    resolve();
                }
            )
        })

        it('claimTokens: should reject payment more that period cap (pre-ico)',  async () => {
            await customContractFunctionCall(_owner, 'restartSale', '___empty___', 0, asyncBlank)
            return expectThrow(customContractFunctionCall(_other, 'claimTokens', '___empty___', web3.toWei(5001), asyncBlank))
        })

        it('claimTokens: should reject payment until token sale started', async () => {
            _startBlock = web3.eth.getBlock('latest').number+10;
            instance = await EtherSport.new(accounts[1],_startBlock, ..._defaultBlockHeightDiff);
            return expectThrow(customContractFunctionCall(_other, 'claimTokens', '___empty___', web3.toWei(0.0005), asyncBlank))
        })

        it('claimTokens: should reject payment after token sale finished by time', async () => {
            _startBlock = web3.eth.getBlock('latest').number+2;
            instance = await EtherSport.new(accounts[1],_startBlock, ..._oneBlockHeightDiff);
            //mine 5 block by simple tx
            await customContractFunctionCall(_owner, 'restartSale', '___empty___', 0, asyncBlank)
            await customContractFunctionCall(_owner, 'restartSale', '___empty___', 0, asyncBlank)
            await customContractFunctionCall(_owner, 'restartSale', '___empty___', 0, asyncBlank)
            await customContractFunctionCall(_owner, 'restartSale', '___empty___', 0, asyncBlank)
            await customContractFunctionCall(_owner, 'restartSale', '___empty___', 0, asyncBlank)
            // try to fund after sale is close
            return expectThrow(customContractFunctionCall(_other, 'claimTokens', '___empty___', web3.toWei(0.0005),
                async (err, resolve, reject) => {
                    if (err) return reject(err)
                    resolve();
                }
            ))
        })

        it('claimTokens: should reject payment if token sale stopped', async () => {
            let isStopped = await instance.isStopped.call();
            assert.strictEqual(isStopped, false)
            return customContractFunctionCall(_owner, 'stopSale', '___empty___', 0,
                async (err, resolve, reject) => {
                    if (err) return reject(err)
                    let isStopped = await instance.isStopped.call();
                    assert.strictEqual(isStopped, true)
                    await expectThrow(customContractFunctionCall(_other, 'claimTokens', '___empty___', 1,
                        async (err, resolve, reject) => {
                            if (err) return reject(err)
                            resolve();
                        }
                    ))
                    resolve();
                }
            )
        })

        it('finalize: should success finalize if token sale finished by cap', async () => {
            let _otherBalance
            let _isFinalized
            _startBlock = web3.eth.getBlock('latest').number+2;
            instance = await EtherSport.new(accounts[1],_startBlock, ...[1,    2, 3, 4, 5,    6]);
            //          |        |                      |                      | tokens for sale | token in ETH | per 1 ETH        | payment ETH |
            //  --------|--------|----------------------|----------------------|-----------------|--------------|------------------|-------------|
            //  Pre ICO | 1 week | 13.11.2017 12:00 UTC | 19.11.2017 12:00 UTC | 10,000,000      | 0.00050      | 2000.00          | 0.0005      |
            await customContractFunctionCall(_other, 'claimTokens', '___empty___', web3.toWei(5000), asyncBlank)
            _otherBalance = await instance.balanceOf.call(_other);
            assert.strictEqual(+web3.fromWei(_otherBalance), 10000000); // We must be sure that owner set properly
            //
            await customContractFunctionCall(_owner, 'restartSale', '___empty___', 0, asyncBlank)
            //  1 stage | 1 hour | 21.11.2017 12:00 UTC | 21.11.2017 13:00 UTC | 10,000,000      | 0.00100      | 1000.00          | 0.0005      |
            await customContractFunctionCall(_other, 'claimTokens', '___empty___', web3.toWei(10000), asyncBlank)
            _otherBalance = await instance.balanceOf.call(_other);
            assert.strictEqual(+web3.fromWei(_otherBalance), 20000000)
            //  2 stage | 1 day  | 22.11.2017 13:00 UTC | 29.11.2017 13:00 UTC | 15,000,000      | 0.00130      | 769.23           | 0.0005      |
            await customContractFunctionCall(_other, 'claimTokens', '___empty___', web3.toWei(19500), asyncBlank)
            _otherBalance = await instance.balanceOf.call(_other);
            assert.strictEqual(+web3.fromWei(_otherBalance), 34999985)
            //  3 stage | 1 week | 22.11.2017 13:00 UTC | 29.11.2017 13:00 UTC | 15,000,000      | 0.00170      | 588.24           | 0.0005      |
            await customContractFunctionCall(_other, 'claimTokens', '___empty___', web3.toWei(25499), asyncBlank)
            _otherBalance = await instance.balanceOf.call(_other);
            assert.strictEqual(+web3.fromWei(_otherBalance), 49999516.76)
            //  4 stage | 3 weeks| 29.11.2017 13:00 UTC | 20.12.2017 13:00 UTC | 20,000,000      | 0.00200      | 500.00           | 0.0005      |
            await customContractFunctionCall(_other, 'claimTokens', '___empty___', web3.toWei(20000), asyncBlank)
            _otherBalance = await instance.balanceOf.call(_other);
            assert.strictEqual(+web3.fromWei(_otherBalance), 59999516.76)

            //  --------|--------|----------------------|----------------------|-----------------|--------------|------------------|-------------|

            _isFinalized = await instance.isFinalized.call();
            assert.strictEqual(_isFinalized, false);
            let ownerBalance
            ownerBalance = web3.fromWei(web3.eth.getBalance(accounts[1])).toNumber()

            await customContractFunctionCall(_owner, 'finalize', '___empty___', 0, asyncBlank)

            let ownerBalanceDiff = web3.fromWei(web3.eth.getBalance(accounts[1])).toNumber() - ownerBalance
            _isFinalized = await instance.isFinalized.call();
            assert.strictEqual(_isFinalized, true);
            assert.strictEqual(ownerBalanceDiff, 5000+10000+19500+25499+20000);

        })
        it('finalize: should success finalize if token sale finished by almost cap', async () => {

        })
        it('finalize: should success finalize if token sale finished by time', async () => {})

        it('finalize: should reject finalize if token sale going on', async () => {
            return expectThrow(customContractFunctionCall(_owner, 'finalize', '___empty___', 0, asyncBlank))
        })

        it('finalize: should reject finalize if token sale finished by time for not owner', async () => {
            _startBlock = web3.eth.getBlock('latest').number+2;
            instance = await EtherSport.new(accounts[1],_startBlock, ..._oneBlockHeightDiff);
            //skip 1 block
            await customContractFunctionCall(_owner, 'restartSale', '___empty___', 0, asyncBlank)
            // buy tokens for 1 ETH
            await customContractFunctionCall(_other, 'claimTokens', '___empty___',
                web3.toWei(1),
                async (err, resolve, reject) => {
                    if (err) return reject(err)
                    let _otherBalance = await instance.balanceOf.call(_other);
                    assert.strictEqual(+web3.fromWei(_otherBalance), 2000); // We must be sure that owner set properly
                    resolve();
                }
            )
            //skip 3 more block
            await customContractFunctionCall(_owner, 'restartSale', '___empty___', 0, asyncBlank)
            await customContractFunctionCall(_owner, 'restartSale', '___empty___', 0, asyncBlank)
            await customContractFunctionCall(_owner, 'restartSale', '___empty___', 0, asyncBlank)
            //finalise
            return expectThrow(customContractFunctionCall(_other, 'finalize', '___empty___', 0, asyncBlank))
        })

        it('finalize: should reject finalize if token sale finished by time', async () => {
            _startBlock = web3.eth.getBlock('latest').number+2;
            instance = await EtherSport.new(accounts[1],_startBlock, ..._oneBlockHeightDiff);
            //skip 1 block
            await customContractFunctionCall(_owner, 'restartSale', '___empty___', 0, asyncBlank)
            // buy tokens for 1 ETH
            await customContractFunctionCall(_other, 'claimTokens', '___empty___',
                web3.toWei(1),
                async (err, resolve, reject) => {
                    if (err) return reject(err)
                    let _otherBalance = await instance.balanceOf.call(_other);
                    assert.strictEqual(+web3.fromWei(_otherBalance), 2000); // We must be sure that owner set properly
                    resolve();
                }
            )
            //skip 3 more block
            await customContractFunctionCall(_owner, 'restartSale', '___empty___', 0, asyncBlank)
            await customContractFunctionCall(_owner, 'restartSale', '___empty___', 0, asyncBlank)
            await customContractFunctionCall(_owner, 'restartSale', '___empty___', 0, asyncBlank)
            //finalise
            return customContractFunctionCall(_owner, 'finalize', '___empty___', 0, asyncBlank)
        })
    })
})
