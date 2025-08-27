
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import MapView from "./pages/MapView";
import Gallery from "./pages/Gallery";
import Stories from "./pages/Stories";
import Story from "./pages/Story";
import Lists from "./pages/Lists";
import ListDetail from "./pages/ListDetail";
import ListMapViewer from "./pages/ListMapViewer";
import AdminDashboard from "./pages/AdminDashboard";
import NotFound from "./pages/NotFound";
import Post from "./pages/Post";
import Reel from "./pages/Reel";
import Posts from "./pages/Posts";
import Reels from "./pages/Reels";
import Authors from "./pages/Authors";
import AuthorDetail from "./pages/AuthorDetail";
import Mentions from "./pages/Mentions";
import MentionsIndex from "./pages/MentionsIndex";
import { OptionsProvider } from "./context/OptionsContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <OptionsProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/stories?style=map" replace />} />
          <Route path="/map" element={<Navigate to="/stories?style=map" replace />} />
          <Route path="/stories" element={<Stories />} />
          <Route path="/lists" element={<Lists />} />
          <Route path="/lists/:slug" element={<ListDetail />} />
          <Route path="/lists/:slug/map" element={<ListMapViewer />} />
          <Route path="/authors" element={<Authors />} />
          <Route path="/authors/:slug" element={<AuthorDetail />} />
          <Route path="/mentions" element={<MentionsIndex />} />
          <Route path="/mentions/:slug" element={<Mentions />} />
          <Route path="/story/:slug" element={<Story />} />
          <Route path="/posts" element={<Posts />} />
          <Route path="/post/:slug" element={<Post />} />
          <Route path="/reels" element={<Reels />} />
          <Route path="/reel/:slug" element={<Reel />} />
          <Route path="/admin" element={<AdminDashboard />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
      </OptionsProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
