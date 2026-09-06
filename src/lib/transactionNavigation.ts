export function getTransactionsUrl(search: string): string {
  return `/transactions${search}`;
}

export function getTransactionUpdateUrl(transactionId: string, search: string): string {
  return `/transactions/update/${transactionId}${search}`;
}

export function getTransactionCreateUrl(pathname: string, search: string): string {
  const isTransactionContext =
    pathname === "/transactions" ||
    pathname === "/transactions/create" ||
    pathname.startsWith("/transactions/update/");

  return `/transactions/create${isTransactionContext ? search : ""}`;
}
