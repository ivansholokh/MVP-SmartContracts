const EtherSportGame =
  artifacts.require(`./EtherSportGame.sol`)

module.exports = (deployer) => {
  console.log('deployer.deploy', Object.keys(deployer))
  deployer.deploy(EtherSportGame
      //, '0xprevContractAddress'
  )
}
