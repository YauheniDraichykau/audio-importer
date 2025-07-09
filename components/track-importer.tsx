"use client";

import { useState, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Music, RotateCcw, Play } from "lucide-react";
import { useSpotifyAuth } from "@/hooks/use-spotify-auth";
import { spotifyApi } from "@/lib/spotify-api";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface TrackImporterProps {
  tracks: string[];
  sourceType: "txt" | "vk";
  onReset: () => void;
}

interface ImportResult {
  track: string;
  status: "pending" | "success" | "error" | "similar";
  spotifyId?: string;
  foundTrack?: string;
  error?: string;
}

export default function TrackImporter({
  tracks,
  sourceType,
  onReset,
}: TrackImporterProps) {
  const [isImporting, setIsImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [playlistId, setPlaylistId] = useState<string | null>(null);
  const { user } = useSpotifyAuth();

  const [playlistName, setPlaylistName] = useState(
    `Импорт из ${sourceType.toUpperCase()} - ${new Date().toLocaleDateString()}`
  );
  const [findSimilar, setFindSimilar] = useState(true);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(-1);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setResults(tracks.map((track) => ({ track, status: "pending" })));
  }, [tracks]);

  const startImport = async () => {
    setIsImporting(true);
    setProgress(0);

    try {
      const playlist = await spotifyApi.createPlaylist(playlistName);
      setPlaylistId(playlist.id);

      const trackIds: string[] = [];

      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        setCurrentTrackIndex(i);

        try {
          const searchResult = await spotifyApi.searchTrack(track, findSimilar);
          console.log("searchResult", searchResult);
          if (searchResult) {
            trackIds.push(searchResult.id);
            const status = searchResult.isExact ? "success" : "similar";
            console.log("FOUND");
            setResults((prev) =>
              prev.map((result, index) =>
                index === i
                  ? {
                      ...result,
                      status,
                      spotifyId: searchResult.id,
                      foundTrack: searchResult.isExact
                        ? undefined
                        : `${searchResult.artists[0].name} - ${searchResult.name}`,
                    }
                  : result
              )
            );
          } else {
            console.log("NOT FOUND");
            setResults((prev) =>
              prev.map((result, index) =>
                index === i
                  ? { ...result, status: "error", error: "Трек не найден" }
                  : result
              )
            );
          }
        } catch (error) {
          console.log("ERROR");
          setResults((prev) =>
            prev.map((result, index) =>
              index === i
                ? { ...result, status: "error", error: "Ошибка поиска" }
                : result
            )
          );
        }

        setProgress(((i + 1) / tracks.length) * 100);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      setCurrentTrackIndex(-1);
      console.log("TRACK IDS", trackIds);
      if (trackIds.length > 0) {
        await spotifyApi.addTracksToPlaylist(playlist.id, trackIds);
      }
    } catch (error) {
      console.error("Import error:", error);
    } finally {
      setIsImporting(false);
    }
  };

  useEffect(() => {
    if (currentTrackIndex >= 0 && resultsRef.current) {
      const trackElement = resultsRef.current.children[
        currentTrackIndex
      ] as HTMLElement;
      if (trackElement) {
        trackElement.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }
  }, [currentTrackIndex]);

  const successCount = results.filter((r) => r.status === "success").length;
  const similarCount = results.filter((r) => r.status === "similar").length;
  const errorCount = results.filter((r) => r.status === "error").length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Импорт треков</span>
            <Badge variant="outline">
              {tracks.length} треков из {sourceType.toUpperCase()}
            </Badge>
          </CardTitle>
          <CardDescription>
            {user && `Импорт в аккаунт: ${user.display_name}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isImporting && results.every((r) => r.status === "pending") && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="playlist-name">Название плейлиста</Label>
                <Input
                  id="playlist-name"
                  value={playlistName}
                  onChange={(e) => setPlaylistName(e.target.value)}
                  placeholder="Введите название плейлиста"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="find-similar"
                  checked={findSimilar}
                  onCheckedChange={(checked) =>
                    setFindSimilar(checked as boolean)
                  }
                />
                <Label htmlFor="find-similar" className="text-sm">
                  Импортировать похожие треки, если точное совпадение не найдено
                </Label>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-800">
                  {findSimilar
                    ? "Будут найдены максимально похожие треки, даже если точное совпадение отсутствует"
                    : "Будут импортированы только треки с точным совпадением названия и исполнителя"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={startImport}
                  className="flex-1"
                  disabled={!playlistName.trim()}
                >
                  <Play className="w-4 h-4 mr-2" />
                  Начать импорт
                </Button>
                <Button variant="outline" onClick={onReset}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Сбросить
                </Button>
              </div>
            </div>
          )}

          {(isImporting || results.some((r) => r.status !== "pending")) && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Прогресс импорта</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} />
              </div>

              {!isImporting && (
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div className="space-y-1">
                    <div className="text-2xl font-bold text-green-600">
                      {successCount}
                    </div>
                    <div className="text-sm text-gray-600">Точные</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-2xl font-bold text-yellow-600">
                      {similarCount}
                    </div>
                    <div className="text-sm text-gray-600">Похожие</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-2xl font-bold text-red-600">
                      {errorCount}
                    </div>
                    <div className="text-sm text-gray-600">Не найдено</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-2xl font-bold text-blue-600">
                      {tracks.length}
                    </div>
                    <div className="text-sm text-gray-600">Всего</div>
                  </div>
                </div>
              )}

              {playlistId && !isImporting && (
                <div className="bg-green-50 p-4 rounded-lg text-center">
                  <p className="text-green-800 font-medium">
                    Плейлист создан успешно!
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 bg-transparent"
                    onClick={() =>
                      window.open(
                        `https://open.spotify.com/playlist/${playlistId}`,
                        "_blank"
                      )
                    }
                  >
                    <Music className="w-4 h-4 mr-2" />
                    Открыть в Spotify
                  </Button>
                </div>
              )}

              {!isImporting && (
                <Button
                  variant="outline"
                  onClick={onReset}
                  className="w-full bg-transparent"
                >
                  Импортировать другие треки
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {results.some((r) => r.status !== "pending") && (
        <Card>
          <CardHeader>
            <CardTitle>Результаты поиска</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="space-y-2 max-h-96 overflow-y-auto"
              ref={resultsRef}
            >
              {results.map((result, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${
                    currentTrackIndex === index
                      ? "border-blue-500 bg-blue-50"
                      : ""
                  }`}
                >
                  <div className="flex-1">
                    <p className="font-medium">{result.track}</p>
                    {result.foundTrack && (
                      <p className="text-sm text-yellow-600">
                        Найден похожий: {result.foundTrack}
                      </p>
                    )}
                    {result.error && (
                      <p className="text-sm text-red-600">{result.error}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {result.status === "success" && (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    )}
                    {result.status === "similar" && (
                      <div className="flex items-center gap-1">
                        <CheckCircle className="w-5 h-5 text-yellow-600" />
                        <Badge variant="secondary" className="text-xs">
                          Похожий
                        </Badge>
                      </div>
                    )}
                    {result.status === "error" && (
                      <XCircle className="w-5 h-5 text-red-600" />
                    )}
                    {result.status === "pending" &&
                      isImporting &&
                      currentTrackIndex === index && (
                        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
