// 生成Base主网钱包地址和私钥
import { Wallet } from 'ethers';
import * as fs from 'fs';

async function generateWallet(): Promise<void> {
  try {
    // 创建一个随机钱包
    const wallet = Wallet.createRandom();

    // 提取地址和私钥
    const address = wallet.address;
    const privateKey = wallet.privateKey;

    // 准备保存的钱包数据
    const walletData = {
      address,
      privateKey,
      network: "base-mainnet", // Base主网
      chainId: 8453
    };

    // 将数据保存到文件
    const fileName = `wallet_data_base_mainnet.txt`;
    fs.writeFileSync(
      fileName,
      JSON.stringify(walletData, null, 2),
      'utf8'
    );

    console.log(`钱包已成功生成并保存到 ${fileName}`);
    console.log(`地址: ${address}`);
    console.log('私钥已保存到文件中（请妥善保管私钥，不要分享给他人）');
  } catch (error) {
    console.error('生成钱包时出错:', error);
  }
}

// 执行函数
generateWallet(); 