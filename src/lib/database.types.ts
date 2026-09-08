export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      venues: {
        Row: {
          id: string;
          name: string;
          timezone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          timezone?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          display_name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string;
        };
        Update: {
          display_name?: string;
        };
        Relationships: [];
      };
      venue_memberships: {
        Row: {
          venue_id: string;
          user_id: string;
          role: "admin" | "manager" | "viewer";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          venue_id: string;
          user_id: string;
          role: "admin" | "manager" | "viewer";
        };
        Update: {
          role?: "admin" | "manager" | "viewer";
        };
        Relationships: [
          {
            foreignKeyName: "venue_memberships_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
        ];
      };
      artists: {
        Row: {
          id: string;
          venue_id: string;
          name: string;
          genre: string | null;
          bio: string | null;
          website_url: string | null;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          venue_id: string;
          name: string;
          genre?: string | null;
          bio?: string | null;
          website_url?: string | null;
          archived_at?: string | null;
        };
        Update: {
          name?: string;
          genre?: string | null;
          bio?: string | null;
          website_url?: string | null;
          archived_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "artists_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
        ];
      };
      events: {
        Row: {
          id: string;
          venue_id: string;
          title: string;
          public_description: string | null;
          internal_notes: string | null;
          event_type: "live_music" | "karaoke" | "dj" | "sports" | "private_event" | "other";
          starts_at: string;
          ends_at: string;
          location_label: string | null;
          status: "draft" | "published" | "cancelled";
          visibility: "public" | "private";
          featured: boolean;
          archived_at: string | null;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
          legacy_source_id: string | null;
          is_ticketed: boolean;
          ticket_url: string | null;
          cover_label: string | null;
        };
        Insert: {
          id?: string;
          venue_id: string;
          title: string;
          public_description?: string | null;
          internal_notes?: string | null;
          event_type: "live_music" | "karaoke" | "dj" | "sports" | "private_event" | "other";
          starts_at: string;
          ends_at: string;
          location_label?: string | null;
          status?: "draft" | "published" | "cancelled";
          visibility?: "public" | "private";
          featured?: boolean;
          archived_at?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          legacy_source_id?: string | null;
          is_ticketed?: boolean;
          ticket_url?: string | null;
          cover_label?: string | null;
        };
        Update: {
          title?: string;
          public_description?: string | null;
          internal_notes?: string | null;
          event_type?: "live_music" | "karaoke" | "dj" | "sports" | "private_event" | "other";
          starts_at?: string;
          ends_at?: string;
          location_label?: string | null;
          status?: "draft" | "published" | "cancelled";
          visibility?: "public" | "private";
          featured?: boolean;
          archived_at?: string | null;
          updated_by?: string | null;
          legacy_source_id?: string | null;
          is_ticketed?: boolean;
          ticket_url?: string | null;
          cover_label?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "events_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
        ];
      };
      event_artists: {
        Row: {
          venue_id: string;
          event_id: string;
          artist_id: string;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          venue_id: string;
          event_id: string;
          artist_id: string;
          display_order?: number;
        };
        Update: {
          display_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "event_artists_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_artists_artist_id_fkey";
            columns: ["artist_id"];
            isOneToOne: false;
            referencedRelation: "artists";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_artists_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
        ];
      };
      booth_state: {
        Row: {
          venue_id: string;
          live_event_id: string | null;
          lower_third_visible: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          venue_id: string;
          live_event_id?: string | null;
          lower_third_visible?: boolean;
        };
        Update: {
          live_event_id?: string | null;
          lower_third_visible?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "booth_state_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: true;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booth_state_live_event_id_fkey";
            columns: ["live_event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      screen_wall_state: {
        Row: {
          venue_id: string;
          mode: "auto" | "manual";
          ads_scene_name: string | null;
          band_scene_name: string | null;
          manual_scene_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          venue_id: string;
          mode?: "auto" | "manual";
          ads_scene_name?: string | null;
          band_scene_name?: string | null;
          manual_scene_name?: string | null;
        };
        Update: {
          mode?: "auto" | "manual";
          ads_scene_name?: string | null;
          band_scene_name?: string | null;
          manual_scene_name?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "screen_wall_state_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: true;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
        ];
      };
      screen_ads: {
        Row: {
          id: string;
          venue_id: string;
          title: string;
          storage_path: string;
          public_url: string;
          media_kind: "image" | "video";
          duration_seconds: number | null;
          transition: "cut" | "fade" | "slide";
          sort_order: number;
          enabled: boolean;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          venue_id: string;
          title: string;
          storage_path: string;
          public_url: string;
          media_kind: "image" | "video";
          duration_seconds?: number | null;
          transition?: "cut" | "fade" | "slide";
          sort_order?: number;
          enabled?: boolean;
          archived_at?: string | null;
        };
        Update: {
          title?: string;
          duration_seconds?: number | null;
          transition?: "cut" | "fade" | "slide";
          sort_order?: number;
          enabled?: boolean;
          archived_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "screen_ads_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      event_listings: {
        Row: {
          id: string;
          venue_id: string;
          title: string;
          event_type: "live_music" | "karaoke" | "dj" | "sports" | "private_event" | "other";
          starts_at: string;
          ends_at: string;
          location_label: string | null;
          featured: boolean;
          is_ticketed: boolean;
          ticket_url: string | null;
          cover_label: string | null;
        };
        Relationships: [];
      };
      event_listing_artists: {
        Row: {
          event_id: string;
          venue_id: string;
          display_order: number;
          name: string;
        };
        Relationships: [];
      };
      screen_ad_listings: {
        Row: {
          id: string;
          venue_id: string;
          title: string;
          public_url: string;
          media_kind: "image" | "video";
          duration_seconds: number | null;
          transition: "cut" | "fade" | "slide";
          sort_order: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      get_public_booth_now: {
        Args: { p_venue_id: string };
        Returns: {
          live_event_id: string | null;
          lower_third_visible: boolean;
          updated_at: string;
        }[];
      };
      current_membership_role: {
        Args: { p_venue_id: string };
        Returns: "admin" | "manager" | "viewer";
      };
      is_venue_member: {
        Args: { p_venue_id: string };
        Returns: boolean;
      };
      has_venue_role: {
        Args: { p_venue_id: string; p_roles: ("admin" | "manager" | "viewer")[] };
        Returns: boolean;
      };
      list_venue_staff: {
        Args: { p_venue_id: string };
        Returns: {
          user_id: string;
          role: "admin" | "manager" | "viewer";
          display_name: string;
          email: string | null;
          created_at: string;
        }[];
      };
    };
    Enums: {
      staff_role: "admin" | "manager" | "viewer";
      event_status: "draft" | "published" | "cancelled";
      event_visibility: "public" | "private";
      event_type: "live_music" | "karaoke" | "dj" | "sports" | "private_event" | "other";
      screen_wall_mode: "auto" | "manual";
      screen_media_kind: "image" | "video";
      screen_transition: "cut" | "fade" | "slide";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
