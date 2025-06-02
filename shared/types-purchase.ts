export interface PurchaseCoinsRequest {
  amount: number; // Montant en centimes
  coins: number;  // Nombre de pièces à créditer
}

export interface PurchaseCoinsResponse {
  clientSecret: string;
}