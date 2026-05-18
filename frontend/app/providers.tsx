"use client";
import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "../custom_library/authContext";
import { queryClient } from "../custom_library/queryClient";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
