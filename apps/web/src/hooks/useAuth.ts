"use client";

import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSignMessage } from "wagmi";
import { api, ApiError, type SessionInfo } from "@/lib/api";

export function useSession() {
  return useQuery<SessionInfo | null>({
    queryKey: ["session"],
    queryFn: async () => {
      try {
        const res = await api.auth.session();
        return res.data;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          return null;
        }
        throw err;
      }
    },
    staleTime: 60_000,
    retry: false,
  });
}

export function useAuth() {
  const queryClient = useQueryClient();
  const session = useSession();
  const { signMessageAsync } = useSignMessage();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const login = useCallback(
    async (address: string, chainId: number) => {
      setIsLoggingIn(true);
      setLoginError(null);
      try {
        const challengeRes = await api.auth.createChallenge({
          chainNamespace: "eip155",
          chainId,
          walletAddress: address,
        });
        const { challengeId, message } = challengeRes.data;

        const signature = await signMessageAsync({ message });

        const verified = await api.auth.verify({ challengeId, signature });
        queryClient.setQueryData(["session"], verified.data);
        await queryClient.invalidateQueries({ queryKey: ["session"] });
        return verified.data;
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Sign-in failed";
        setLoginError(message);
        throw err;
      } finally {
        setIsLoggingIn(false);
      }
    },
    [queryClient, signMessageAsync],
  );

  const logoutMutation = useMutation({
    mutationFn: () => api.auth.logout(),
    onSettled: async () => {
      queryClient.setQueryData(["session"], null);
      await queryClient.invalidateQueries({ queryKey: ["session"] });
    },
  });

  return {
    session: session.data ?? null,
    user: session.data?.user ?? null,
    isSessionLoading: session.isLoading,
    isAuthenticated: !!session.data,
    login,
    isLoggingIn,
    loginError,
    logout: logoutMutation.mutate,
    logoutAsync: logoutMutation.mutateAsync,
    isLoggingOut: logoutMutation.isPending,
  };
}
