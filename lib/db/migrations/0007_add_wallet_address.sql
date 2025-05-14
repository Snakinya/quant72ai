ALTER TABLE "Wallet" ALTER COLUMN "smartWalletAddress" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "Wallet" ADD COLUMN "walletAddress" text; 