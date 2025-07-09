"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Music } from "lucide-react";
import { useSpotifyAuth } from "@/hooks/use-spotify-auth";

export default function SpotifyAuth() {
  const { login, isLoading } = useSpotifyAuth();

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2">
          <Music className="w-6 h-6 text-green-600" />
          Авторизация в Spotify
        </CardTitle>
        <CardDescription>
          Войдите в свой аккаунт Spotify для импорта треков
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        <div className="bg-green-50 p-4 rounded-lg">
          <p className="text-sm text-green-800">
            Мы используем официальный Spotify Web API для безопасного доступа к
            вашей музыкальной библиотеке
          </p>
        </div>
        <Button
          onClick={login}
          disabled={isLoading}
          className="w-full bg-green-600 hover:bg-green-700"
          size="lg"
        >
          {isLoading ? "Подключение..." : "Войти через Spotify"}
        </Button>
        <p className="text-xs text-gray-500">
          Требуются права на создание и изменение плейлистов
        </p>
      </CardContent>
    </Card>
  );
}
