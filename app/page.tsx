"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Link, Music } from "lucide-react";
import SpotifyAuth from "@/components/spotify-auth";
import TrackImporter from "@/components/track-importer";
import { useSpotifyAuth } from "@/hooks/use-spotify-auth";

export default function HomePage() {
  const [sourceType, setSourceType] = useState<"txt" | "vk" | null>(null);
  const [txtFile, setTxtFile] = useState<File | null>(null);
  const [vkUrl, setVkUrl] = useState("");
  const [tracks, setTracks] = useState<string[]>([]);
  const { isAuthenticated, user } = useSpotifyAuth();

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === "text/plain") {
      setTxtFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const trackList = content.split("\n").filter((line) => line.trim());
        setTracks(trackList);
      };
      reader.readAsText(file);
    }
  };

  // const handleVkUrlSubmit = () => {
  //   if (vkUrl) {
  //     // TODO: Implement VK API integration
  //     // This is where VK provider will be integrated
  //     console.log("VK URL:", vkUrl);

  //     // Mock tracks for demo
  //     const mockTracks = [
  //       "Imagine Dragons - Believer",
  //       "The Weeknd - Blinding Lights",
  //       "Dua Lipa - Levitating",
  //     ];
  //     setTracks(mockTracks);
  //   }
  // };

  const handleVkUrlSubmit = async () => {
    if (!vkUrl) return;
    try {
      const res = await fetch(`/api/vk?link=${encodeURIComponent(vkUrl)}`);
      const json = await res.json();
      if (json.tracks) {
        setTracks(json.tracks);
      } else {
        alert(json.error ?? "Не удалось получить треки");
      }
    } catch {
      alert("Ошибка сети");
    }
  };

  const resetSource = () => {
    setSourceType(null);
    setTxtFile(null);
    setVkUrl("");
    setTracks([]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-purple-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-3xl font-bold">
            <Music className="w-8 h-8 text-green-600" />
            VK → Spotify Importer
          </div>
          <p className="text-gray-600">
            Импортируйте ваши треки из VK в Spotify легко и быстро
          </p>
        </div>

        {!sourceType && (
          <Card>
            <CardHeader>
              <CardTitle>Выберите источник треков</CardTitle>
              <CardDescription>
                Загрузите txt файл со списком треков или укажите ссылку на VK
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="txt" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="txt">TXT файл</TabsTrigger>
                  <TabsTrigger value="vk">VK ссылка</TabsTrigger>
                </TabsList>

                <TabsContent value="txt" className="space-y-4">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                    <Label htmlFor="file-upload" className="cursor-pointer">
                      <span className="text-lg font-medium">
                        Загрузить TXT файл
                      </span>
                      <p className="text-sm text-gray-500 mt-1">
                        Каждый трек на новой строке в формате "Исполнитель -
                        Название"
                      </p>
                    </Label>
                    <Input
                      id="file-upload"
                      type="file"
                      accept=".txt"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </div>
                  {txtFile && (
                    <div className="space-y-2">
                      <p className="text-sm text-green-600">
                        Файл загружен: {txtFile.name}
                      </p>
                      <Button
                        onClick={() => setSourceType("txt")}
                        className="w-full"
                      >
                        Продолжить с TXT файлом
                      </Button>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="vk" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="vk-url">
                      Ссылка на VK плейлист или аудио
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="vk-url"
                        placeholder="https://vk.com/audios123456789"
                        value={vkUrl}
                        onChange={(e) => setVkUrl(e.target.value)}
                      />
                      <Button onClick={handleVkUrlSubmit} disabled={!vkUrl}>
                        <Link className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500">
                      {/* TODO: Add VK provider integration */}
                      Поддерживаются ссылки на плейлисты и страницы с аудио
                    </p>
                  </div>
                  {tracks.length > 0 && (
                    <Button
                      onClick={() => setSourceType("vk")}
                      className="w-full"
                    >
                      Продолжить с VK ({tracks.length} треков)
                    </Button>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        {sourceType && !isAuthenticated && <SpotifyAuth />}

        {sourceType && isAuthenticated && tracks.length > 0 && (
          <TrackImporter
            tracks={tracks}
            sourceType={sourceType}
            onReset={resetSource}
          />
        )}

        {/* TODO: Add payment integration section */}
        {/* This is where Stripe/Paddle integration will be added */}
      </div>
    </div>
  );
}
