**什么是Monad?**

Monad 是一条高性能且兼容 EVM 的 Layer 1 区块链，专为卓越吞吐量和低廉交易成本而设计。它通过引入并行执行等创新优化方案，突破了现有 EVM 实现的技术瓶颈，使开发者能够构建可扩展至满足现实世界需求的新一代去中心化应用。

**Monad的加速型EVM:**

Monad加速版EVM通过大幅提升吞吐量和降低交易成本，为去中心化应用开辟了新可能，且无需开发者学习新语言或工具。这意味着您能在保持EVM熟悉度与安全性的前提下，构建更快速、更高效的dApp。

**快速链接:**

[Monad Wiki](https://www.notion.so/2ae6367594f28122811bee00ff31f225?pvs=21)

[**Monad Developer Portal**](https://developers.monad.xyz/)

[**Monad Docs**](https://docs.monad.xyz/)

### Monad Testnet 信息

- [`https://testnet-rpc.monad.xyz`](https://testnet-rpc.monad.xyz) - RPC URL
- `10143` - ChainID
- `0x279F`  - ChainID (Hex)
- https://testnet.monad.xyz - 水龙头
- 浏览器:
    - https://testnet.monadexplorer.com/
    - https://monad-testnet.socialscan.io/

    ### 典型智能合约地址

- 👈 **点击此处展开**
    
    
    <aside>
    🔄
    
    [**Testnet Uniswap Deployment](https://app.uniswap.org/swap?chain=monad&inputCurrency=NATIVE&outputCurrency=0x88b8e2161dedc77ef4ab7585569d2415a1c1055d&value=1&field=input) (从 MON 获取 WMON)**
    
    </aside>
    
    | Name | Address |
    | --- | --- |
    | Multicall3 | [0xcA11bde05977b3631167028862bE2a173976CA11](https://testnet.monadexplorer.com/address/0xcA11bde05977b3631167028862bE2a173976CA11) |
    | UniswapV2Factory | [0x733e88f248b742db6c14c0b1713af5ad7fdd59d0](https://testnet.monadexplorer.com/address/0x733E88f248b742db6C14C0b1713Af5AD7fDd59D0) |
    | UniswapV2Router02 | [0xfb8e1c3b833f9e67a71c859a132cf783b645e436](https://testnet.monadexplorer.com/address/0xfB8e1C3b833f9E67a71C859a132cf783b645e436) |
    | UniswapV3Factory | [0x961235a9020b05c44df1026d956d1f4d78014276](https://testnet.monadexplorer.com/address/0x961235a9020B05C44DF1026D956D1F4D78014276) |
    | UniversalRouter | [0x3aE6D8A282D67893e17AA70ebFFb33EE5aa65893](https://testnet.monadexplorer.com/address/0x3aE6D8A282D67893e17AA70ebFFb33EE5aa65893) |
    | WrappedMonad | [0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701](https://testnet.monadexplorer.com/address/0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701) |
    | USDC | [0xf817257fed379853cDe0fa4F97AB987181B1E5Ea](https://testnet.monadexplorer.com/address/0xf817257fed379853cDe0fa4F97AB987181B1E5Ea) |
    | USDT | [0x88b8E2161DEDC77EF4ab7585569D2415a1C1055D](https://testnet.monadexplorer.com/address/0x88b8E2161DEDC77EF4ab7585569D2415a1C1055D) |
    | WBTC | [0xcf5a6076cfa32686c0Df13aBaDa2b40dec133F1d](https://testnet.monadexplorer.com/address/0xcf5a6076cfa32686c0Df13aBaDa2b40dec133F1d) |
    | WETH | [0xB5a30b0FDc5EA94A52fDc42e3E9760Cb8449Fb37](https://testnet.monadexplorer.com/address/0xB5a30b0FDc5EA94A52fDc42e3E9760Cb8449Fb37) |
    | CreateX | [0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed](https://testnet.monadexplorer.com/address/0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed) |
    | Permit2 | [0x000000000022d473030f116ddee9f6b43ac78ba3](https://testnet.monadexplorer.com/address/0x000000000022D473030F116dDEE9F6B43aC78BA3) |
    
    **❓ 需要将这些资产吗？请私信Monad团队成员。**
    

### 验证智能合约

- 👈 **点击此处展开**
    
    
    | Verifier | sourcify |
    | --- | --- |
    | Verifier URL | https://sourcify-api-monad.blockvision.org |
    | API Key | “” (leave it blank) |
    - **通过Foundry验证合约**
        
        ```bash
        forge verify-contract \
          --rpc-url https://testnet-rpc2.monad.xyz/52227f026fa8fac9e2014c58fbf5643369b3bfc6 \
          --verifier sourcify \
          --verifier-url 'https://sourcify-api-monad.blockvision.org' \
          [contractAddress] \
          [contractFile]:[contractName]
        ```
        
    - **通过Hardhat验证合约**
        
        ```jsx
        const config: HardhatUserConfig = {
          solidity: "0.8.25", // replace if necessary
          networks: {
            'monad': {
              url: 'https://explorer.monad-testnet.category.xyz/api/eth-rpc',
              chainId: 10143
            },
          },
          sourcify: {
        	  enabled: true,
        	  apiUrl: "https://sourcify-api-monad.blockvision.org/",
        	  browserUrl: "https://testnet.monadexplorer.com/"
          },
          etherscan: {
            enabled: false,
          }
        };
        ```
        
        ```bash
        npx hardhat verify \
          --network monad \
          0xa6aD802896dAbEf770Cfd470Ea72172f66217681 \
          [...constructorArgs]
        ```
        

### 提交事务和查询的推荐做法

- 👈 **点击此处展开**
    
    
    <aside>
    
    ⛽️ Gas价格必须 ***设定*** 为最低 `50 gwei` 的基础费用（以MON计价）。您也可以设置更高的价格，但通常没有必要这样做。
    
    </aside>
    
    - 要获取交易receipts，请使用`eth_getBlockReceipts`而非`eth_getTransactionReceipt`，以便一次性获取区块内所有交易的receipts。
    - 要获取区块中所有交易详情，请使用 `eth_getBlockByNumber(number, hydrated=True)` 而非 `eth_getTransactionByHash`
    - 同样地，使用`debug_traceBlockByNumber`替代`debug_traceTransaction`，以便在一次调用请求中获取区块内所有交易的追踪数据。

### 账户抽象化 / 社交登录 / 嵌入式钱包

[发送交易](https://docs.privy.io/wallets/using-wallets/ethereum/send-a-transaction)

[在Monad上实现无GAS交易](https://docs.privy.io/wallets/gas-and-asset-management/gas/ethereum) (确保将配置更改为Monad测试网)

https://docs.pimlico.io/guides/tutorials/tutorial-1

[Privy API reference](https://docs.privy.io/api-reference/introduction)

https://docs.pimlico.io/guides/how-to/signers/privy

### 跨链

[CCIP Lanes Monad Testnet](https://docs.chain.link/ccip/directory/testnet/chain/monad-testnet)

[CCIP Getting Started](https://docs.chain.link/ccip/getting-started)

[LayerZero Deployments](https://docs.layerzero.network/v2/deployments/deployed-contracts)

[LayerZero Getting Started](https://docs.layerzero.network/v2/developers/evm/getting-started)

### 索引器

[Using Envio HyperIndex](https://docs.monad.xyz/guides/indexers/tg-bot-using-envio)

[QuickNode streams guide](https://docs.monad.xyz/guides/indexers/quicknode-streams)

### APIs / NFT API / Portfolio API

[NFT Holders](https://docs.codex.io/reference/nftholders)

[Wallet NFT Collections](https://docs.codex.io/reference/walletnftcollections)

[NFT Collection Metadata](https://docs.codex.io/reference/getnftcollectionmetadata)

[Get wallet's portfolio](https://developers.zerion.io/reference/getwalletportfolio)

[Get list of wallet's transactions](https://developers.zerion.io/reference/listwallettransactions)

[Get wallet's NFT portfolio](https://developers.zerion.io/reference/getwalletnftportfolio)

[Alchemy NFT API](https://www.alchemy.com/docs/reference/nft-api-quickstart)

[Alchemy Portfolio API](https://www.alchemy.com/docs/reference/portfolio-apis)

[Alchemy Token API](https://www.alchemy.com/docs/reference/token-api-quickstart)

[Alchemy Webhooks](https://www.alchemy.com/docs/reference/notify-api-quickstart)

### 预言机

[Chainlink Data Streams](https://docs.chain.link/data-streams)

[Pyth Price Feeds](https://www.pyth.network/developers/price-feed-ids)

[Pyth Beta Price Feeds](https://www.pyth.network/developers/price-feed-ids#beta)

[Pyth Oracle Addresses](https://docs.pyth.network/price-feeds/contract-addresses/evm)

### Wallet Connectors

[Using Reown Wallet Connector](https://docs.monad.xyz/guides/reown-guide)

### 学习Solidity

- [CryptoZombies](https://cryptozombies.io/en/course) - Learn Solidity while building a Zombie game
- [Solidity by example](https://solidity-by-example.org/)
- [Blockchain Basics course by Cyfrin](https://updraft.cyfrin.io/courses/blockchain-basics)
- [Solidity Smart Contract Development Course by Cyfrin](https://updraft.cyfrin.io/courses/solidity)
- [Foundry Fundamentals Development Course by Cyfrin](https://updraft.cyfrin.io/courses/foundry) - Foundry is one of the best tools for smart contract development
- [Rareskills Blog](https://www.rareskills.io/category/solidity) - One of the best blogs to learn Solidity coding practices and patterns
- [Openzeppelin Smart Contracts](https://www.openzeppelin.com/solidity-contracts) - Most battle-tested Smart Contract Library
- [Ethernaut](https://ethernaut.openzeppelin.com/) - Solidity Puzzles

### 学习 DeFi

- [Awesome Stablecoins](https://github.com/sdtsui/awesome-stablecoins) - Everything you need to know about Stablecoins
- [Awesome Decentralized Finance](https://github.com/ong/awesome-decentralized-finance) - Many DeFi resources in one repo
- [DeFi MooC](https://defi-learning.org/f22) - One of the best DeFi courses with lab exercises

 

### 学习 EVM

- [EVM: From Solidity to byte code, memory and storage](https://www.youtube.com/watch?v=RxL_1AfV7N4)
- [Ethereum EVM illustrated](https://takenobu-hs.github.io/downloads/ethereum_evm_illustrated.pdf)
- [EVM Deep Dives Series](https://noxx.substack.com/p/evm-deep-dives-the-path-to-shadowy)
- [Understanding Ethereum Smart Contract Storage](https://programtheblockchain.com/posts/2018/03/09/understanding-ethereum-smart-contract-storage/)
- [EVM.codes](https://www.evm.codes/) - Details about EVM opcodes

### Monad 内部实现

- https://docs.monad.xyz/monad-arch/consensus/monad-bft
- https://docs.monad.xyz/monad-arch/consensus/asynchronous-execution
- https://docs.monad.xyz/monad-arch/execution/parallel-execution