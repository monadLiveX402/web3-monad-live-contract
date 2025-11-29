import hardhat from "hardhat";

const { ethers, network } = hardhat;

async function main() {
  console.log(`\n🔍 Checking TipStream contract on ${network.name}...\n`);

  const TIP_STREAM_ADDRESS = "0x2dAA2b2370F37179E40E815b6D1f05cb107fE8c4";

  const TipStream = await ethers.getContractFactory("TipStream");
  const tipStream = TipStream.attach(TIP_STREAM_ADDRESS);

  // 检查 scheme 数量
  const schemeCount = await tipStream.getSchemeCount();
  console.log(`Scheme count: ${schemeCount}`);

  if (schemeCount > 0n) {
    console.log(`\nDefault scheme details:`);
    const [name, recipients, percentages, active, createdAt] = await tipStream.getScheme(0);
    console.log(`  Name: ${name}`);
    console.log(`  Recipients: ${recipients}`);
    console.log(`  Percentages: ${percentages.map(p => Number(p) / 100 + '%')}`);
    console.log(`  Active: ${active}`);
    console.log(`  Created at: ${createdAt}\n`);
  } else {
    console.log(`\n⚠️  No schemes found! TipStream needs at least one scheme.\n`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
