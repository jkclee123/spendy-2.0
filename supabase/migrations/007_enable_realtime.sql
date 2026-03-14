ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
ALTER TABLE transactions REPLICA IDENTITY FULL;
