const EtherSportGame =
  artifacts.require(`./EtherSportGame.sol`)

module.exports = (deployer) => {
  console.log('deployer.deploy', Object.keys(deployer))
  deployer.deploy(EtherSportGame,
      '0x52eac68BEaFB8FFBde44C14e71BE31a9f4161D44'
  )
}
