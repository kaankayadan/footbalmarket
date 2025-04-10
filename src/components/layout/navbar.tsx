"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "next-auth/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, Search, Menu, TrendingUp } from "lucide-react";
import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const categories = [
  { name: "Trending", href: "/", icon: <TrendingUp className="h-4 w-4 mr-2" /> },
  { name: "Premier League", href: "/categories/premier-league" },
  { name: "La Liga", href: "/categories/la-liga" },
  { name: "Bundesliga", href: "/categories/bundesliga" },
  { name: "Serie A", href: "/categories/serie-a" },
  { name: "Champions League", href: "/categories/champions-league" },
  { name: "World Cup", href: "/categories/world-cup" },
];

export function Navbar() {
  const { data: session } = useSession();
  const [searchQuery, setSearchQuery] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  // Fetch user's admin status
  useEffect(() => {
    const fetchUserData = async () => {
      if (session?.user?.email) {
        try {
          const response = await fetch("/api/user/me");
          if (response.ok) {
            const userData = await response.json();
            setIsAdmin(userData.isAdmin);
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      }
    };

    if (session) {
      fetchUserData();
    }
  }, [session]);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background">
      <div className="container flex h-16 items-center px-4 sm:px-6">
        <div className="flex items-center gap-2 mr-4">
          <Sheet>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="pr-0">
              <nav className="flex flex-col gap-4 mt-8">
                {categories.map((category) => (
                  <Link
                    key={category.name}
                    href={category.href}
                    className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-accent hover:text-accent-foreground"
                  >
                    {category.icon}
                    {category.name}
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>

          <Link href="/" className="flex items-center space-x-2">
            <span className="font-bold text-xl">FootballMarket</span>
          </Link>
        </div>

        <div className="relative flex-1 max-w-md mx-4 hidden md:flex">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search markets"
              className="w-full pl-8 pr-4"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-6 mx-6">
          {categories.map((category) => (
            <Link
              key={category.name}
              href={category.href}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center"
            >
              {category.icon}
              {category.name}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4 ml-auto">
          {session ? (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={session.user?.image || ""} alt={session.user?.name || "User"} />
                      <AvatarFallback>
                        {session.user?.name?.charAt(0) || session.user?.email?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href="/profile">Profile</Link>
                  </DropdownMenuItem>
                  {isAdmin && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link href="/admin">Admin Dashboard</Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuItem asChild>
                    <Link href="/api/auth/signout">Sign Out</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login">
                <Button variant="outline">Log In</Button>
              </Link>
              <Link href="/register">
                <Button>Sign Up</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
