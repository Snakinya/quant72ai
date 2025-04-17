import React from 'react';

interface TransactionInfo {
  amount: string;
  recipient: string;
  hash: string;
  unit?: string;
  amountInEth?: string;
}

export const TransactionCard = ({ transaction }: { transaction: TransactionInfo }) => {
  return (
    <div className="flex flex-col gap-4 rounded-2xl p-4 bg-green-800 max-w-[500px]">
      <div className="flex flex-row justify-between items-center">
        <div className="flex flex-row gap-2 items-center">
          <div className="size-10 rounded-full bg-green-200 flex items-center justify-center">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="24" 
              height="24" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              className="text-green-800"
            >
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <div className="text-2xl font-medium text-green-50">Transaction Successful</div>
        </div>
        <div className="text-green-50 bg-green-700 px-2 py-1 rounded-lg">ETH</div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 bg-green-700 rounded-xl p-3">
          <div className="text-green-200 text-sm">Amount Transferred</div>
          <div className="text-green-50 font-mono text-sm">
            {transaction.amount} {transaction.unit || 'WEI'}
            {transaction.amountInEth && (
              <span className="block text-green-300 text-xs mt-1">
                ({transaction.amountInEth})
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 bg-green-700 rounded-xl p-3">
          <div className="text-green-200 text-sm">Recipient Address</div>
          <div className="text-green-50 font-mono text-sm break-all">{transaction.recipient}</div>
        </div>

        <div className="flex flex-col gap-2 bg-green-700 rounded-xl p-3">
          <div className="text-green-200 text-sm">Transaction Hash</div>
          <div className="text-green-50 font-mono text-sm break-all">{transaction.hash}</div>
        </div>
      </div>

      <div className="text-green-300 text-xs text-right">Powered by Coinbase AgentKit</div>
    </div>
  );
}; 