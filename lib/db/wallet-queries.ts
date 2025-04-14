import 'server-only';

import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { wallet, type Wallet } from './schema';
import { Address, Hex } from 'viem';

// 钱包数据类型
export type WalletData = {
  privateKey: Hex;
  smartWalletAddress: Address;
  networkId: string;
};

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

/**
 * 根据用户ID获取钱包信息
 */
export async function getWalletByUserId(userId: string): Promise<Wallet | undefined> {
  try {
    const wallets = await db
      .select()
      .from(wallet)
      .where(eq(wallet.userId, userId));
    
    return wallets[0];
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
  networkId = 'base-mainnet',
}: {
  userId: string;
  privateKey: Hex;
  smartWalletAddress: Address;
  networkId?: string;
}): Promise<void> {
  try {
    // 检查用户是否已有钱包
    const existingWallet = await getWalletByUserId(userId);

    if (existingWallet) {
      // 更新现有钱包
      await db
        .update(wallet)
        .set({
          privateKey,
          smartWalletAddress,
          networkId,
          updatedAt: new Date(),
        })
        .where(eq(wallet.id, existingWallet.id));
    } else {
      // 创建新钱包
      await db.insert(wallet).values({
        userId,
        privateKey,
        smartWalletAddress,
        networkId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  } catch (error) {
    console.error('保存用户钱包失败:', error);
    throw error;
  }
}