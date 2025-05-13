import 'server-only';

import { eq, and } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { wallet, type Wallet } from './schema';
import { Address, Hex } from 'viem';

// 钱包数据类型
export type WalletData = {
  privateKey: Hex;
  smartWalletAddress?: Address;
  walletAddress?: Address;
  networkId: string;
};

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

/**
 * 根据用户ID获取钱包信息
 * @param userId 用户ID
 * @param networkId 可选的网络ID (如 'bsc', 'base-mainnet' 等)
 */
export async function getWalletByUserId(userId: string, networkId?: string): Promise<Wallet | undefined> {
  try {
    if (networkId) {
      // 如果提供了网络ID，获取特定网络的钱包
      const wallets = await db
        .select()
        .from(wallet)
        .where(and(
          eq(wallet.userId, userId),
          eq(wallet.networkId, networkId)
        ));
      
      return wallets[0];
    } else {
      // 否则获取默认/第一个钱包
      const wallets = await db
        .select()
        .from(wallet)
        .where(eq(wallet.userId, userId));
      
      return wallets[0];
    }
  } catch (error) {
    console.error('获取用户钱包失败:', error);
    return undefined;
  }
}

/**
 * 创建或更新用户钱包
 */
export async function saveWallet({
  userId,
  privateKey,
  smartWalletAddress,
  walletAddress,
  networkId = 'base-mainnet',
}: {
  userId: string;
  privateKey: Hex;
  smartWalletAddress?: Address;
  walletAddress?: Address;
  networkId?: string;
}): Promise<void> {
  try {
    // 确保至少有一个地址类型
    if (!smartWalletAddress && !walletAddress) {
      throw new Error('必须提供smartWalletAddress或walletAddress');
    }
    
    // 检查用户是否已有特定网络的钱包
    const existingWallet = await getWalletByUserId(userId, networkId);
    
    // 准备更新数据
    const walletData: any = {
      privateKey,
      networkId,
      updatedAt: new Date(),
    };
    
    // 根据提供的地址类型设置相应字段
    if (smartWalletAddress) {
      walletData.smartWalletAddress = smartWalletAddress;
    }
    
    if (walletAddress) {
      walletData.walletAddress = walletAddress;
    }

    if (existingWallet) {
      // 更新现有钱包
      await db
        .update(wallet)
        .set(walletData)
        .where(eq(wallet.id, existingWallet.id));
    } else {
      // 创建新钱包
      await db.insert(wallet).values({
        userId,
        ...walletData,
        createdAt: new Date(),
      });
    }
  } catch (error) {
    console.error('保存用户钱包失败:', error);
    throw error;
  }
}

/**
 * 获取用户所有钱包
 */
export async function getAllWalletsByUserId(userId: string): Promise<Wallet[]> {
  try {
    return await db
      .select()
      .from(wallet)
      .where(eq(wallet.userId, userId));
  } catch (error) {
    console.error('获取用户所有钱包失败:', error);
    return [];
  }
}

/**
 * 删除用户特定网络的钱包
 */
export async function deleteWallet(userId: string, networkId: string): Promise<void> {
  try {
    await db
      .delete(wallet)
      .where(and(
        eq(wallet.userId, userId),
        eq(wallet.networkId, networkId)
      ));
  } catch (error) {
    console.error('删除用户钱包失败:', error);
    throw error;
  }
}