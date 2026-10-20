export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      venues: {
        Row: {
          id: string;
          name: string;
          timezone: string;
          wall_ops_user_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          timezone?: string;
          wall_ops_user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          timezone?: string;
          wall_ops_user_id?: string | null;
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
          role: "admin" | "manager" | "interactor" | "viewer" | "server";
          menus: string[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          venue_id: string;
          user_id: string;
          role: "admin" | "manager" | "interactor" | "viewer" | "server";
          menus?: string[] | null;
        };
        Update: {
          role?: "admin" | "manager" | "interactor" | "viewer" | "server";
          menus?: string[] | null;
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
          media_kind: "image" | "video" | "week_events" | "youtube";
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
          media_kind: "image" | "video" | "week_events" | "youtube";
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
      menu_specials: {
        Row: {
          id: string;
          venue_id: string;
          title: string;
          subtitle: string | null;
          category: "food" | "drink";
          price_label: string | null;
          storage_path: string;
          public_url: string;
          media_kind: "image" | "video";
          duration_seconds: number;
          starts_at: string | null;
          ends_at: string | null;
          enabled: boolean;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          venue_id: string;
          title: string;
          subtitle?: string | null;
          category: "food" | "drink";
          price_label?: string | null;
          storage_path: string;
          public_url: string;
          media_kind?: "image" | "video";
          duration_seconds?: number;
          starts_at?: string | null;
          ends_at?: string | null;
          enabled?: boolean;
          archived_at?: string | null;
        };
        Update: {
          title?: string;
          subtitle?: string | null;
          category?: "food" | "drink";
          price_label?: string | null;
          duration_seconds?: number;
          starts_at?: string | null;
          ends_at?: string | null;
          enabled?: boolean;
          archived_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "menu_specials_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
        ];
      };
      screen_playlists: {
        Row: {
          id: string;
          venue_id: string;
          name: string;
          is_active: boolean;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          venue_id: string;
          name: string;
          is_active?: boolean;
          archived_at?: string | null;
        };
        Update: {
          name?: string;
          is_active?: boolean;
          archived_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "screen_playlists_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
        ];
      };
      screen_playlist_items: {
        Row: {
          id: string;
          playlist_id: string;
          venue_id: string;
          source_kind: "media" | "special" | "week_events";
          media_id: string | null;
          special_id: string | null;
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
          playlist_id: string;
          venue_id: string;
          source_kind: "media" | "special" | "week_events";
          media_id?: string | null;
          special_id?: string | null;
          duration_seconds?: number | null;
          transition?: "cut" | "fade" | "slide";
          sort_order?: number;
          enabled?: boolean;
          archived_at?: string | null;
        };
        Update: {
          source_kind?: "media" | "special" | "week_events";
          media_id?: string | null;
          special_id?: string | null;
          duration_seconds?: number | null;
          transition?: "cut" | "fade" | "slide";
          sort_order?: number;
          enabled?: boolean;
          archived_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "screen_playlist_items_playlist_id_fkey";
            columns: ["playlist_id"];
            isOneToOne: false;
            referencedRelation: "screen_playlists";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "screen_playlist_items_media_id_fkey";
            columns: ["media_id"];
            isOneToOne: false;
            referencedRelation: "screen_ads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "screen_playlist_items_special_id_fkey";
            columns: ["special_id"];
            isOneToOne: false;
            referencedRelation: "menu_specials";
            referencedColumns: ["id"];
          },
        ];
      };
      led_wall_scenes: {
        Row: {
          id: string;
          venue_id: string;
          title: string;
          kind: "obs" | "media" | "trivia" | "audience";
          obs_scene_name: string | null;
          media_kind: "image" | "video" | "week_events" | "youtube" | null;
          storage_path: string | null;
          public_url: string | null;
          artist_id: string | null;
          sort_order: number;
          enabled: boolean;
          server_approved: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          venue_id: string;
          title: string;
          kind: "obs" | "media" | "trivia" | "audience";
          obs_scene_name?: string | null;
          media_kind?: "image" | "video" | "week_events" | "youtube" | null;
          storage_path?: string | null;
          public_url?: string | null;
          artist_id?: string | null;
          sort_order?: number;
          enabled?: boolean;
          server_approved?: boolean;
        };
        Update: {
          title?: string;
          kind?: "obs" | "media" | "trivia" | "audience";
          obs_scene_name?: string | null;
          media_kind?: "image" | "video" | "week_events" | "youtube" | null;
          storage_path?: string | null;
          public_url?: string | null;
          artist_id?: string | null;
          sort_order?: number;
          enabled?: boolean;
          server_approved?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "led_wall_scenes_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "led_wall_scenes_artist_id_fkey";
            columns: ["artist_id"];
            isOneToOne: true;
            referencedRelation: "artists";
            referencedColumns: ["id"];
          },
        ];
      };
      led_wall_settings: {
        Row: {
          venue_id: string;
          media_obs_scene_name: string | null;
          agent_token_issued_at: string | null;
          default_playlist_id: string | null;
          last_ad_roll_reset_on: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          venue_id: string;
          media_obs_scene_name?: string | null;
          agent_token_issued_at?: string | null;
          default_playlist_id?: string | null;
          last_ad_roll_reset_on?: string | null;
        };
        Update: {
          media_obs_scene_name?: string | null;
          agent_token_issued_at?: string | null;
          default_playlist_id?: string | null;
          last_ad_roll_reset_on?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "led_wall_settings_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: true;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "led_wall_settings_default_playlist_id_fkey";
            columns: ["default_playlist_id"];
            isOneToOne: false;
            referencedRelation: "led_wall_playlists";
            referencedColumns: ["id"];
          },
        ];
      };
      led_wall_agent_secrets: {
        Row: {
          venue_id: string;
          token_hash: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          venue_id: string;
          token_hash: string;
        };
        Update: {
          token_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: "led_wall_agent_secrets_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: true;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
        ];
      };
      led_wall_runtime: {
        Row: {
          venue_id: string;
          active_scene_id: string | null;
          active_playlist_id: string | null;
          activation_source: "manual" | "artist_auto" | "ad_roll" | "server_override";
          auto_event_id: string | null;
          auto_artist_id: string | null;
          activated_by: string | null;
          activated_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          venue_id: string;
          active_scene_id?: string | null;
          active_playlist_id?: string | null;
          activation_source?: "manual" | "artist_auto" | "ad_roll" | "server_override";
          auto_event_id?: string | null;
          auto_artist_id?: string | null;
          activated_by?: string | null;
          activated_at?: string | null;
        };
        Update: {
          active_scene_id?: string | null;
          active_playlist_id?: string | null;
          activation_source?: "manual" | "artist_auto" | "ad_roll" | "server_override";
          auto_event_id?: string | null;
          auto_artist_id?: string | null;
          activated_by?: string | null;
          activated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "led_wall_runtime_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: true;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "led_wall_runtime_active_scene_id_fkey";
            columns: ["active_scene_id"];
            isOneToOne: false;
            referencedRelation: "led_wall_scenes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "led_wall_runtime_active_playlist_id_fkey";
            columns: ["active_playlist_id"];
            isOneToOne: false;
            referencedRelation: "led_wall_playlists";
            referencedColumns: ["id"];
          },
        ];
      };
      led_wall_playlists: {
        Row: {
          id: string;
          venue_id: string;
          name: string;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          venue_id: string;
          name: string;
          archived_at?: string | null;
        };
        Update: {
          name?: string;
          archived_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "led_wall_playlists_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
        ];
      };
      led_wall_playlist_items: {
        Row: {
          id: string;
          playlist_id: string;
          venue_id: string;
          scene_id: string;
          duration_seconds: number;
          sort_order: number;
          enabled: boolean;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          playlist_id: string;
          venue_id: string;
          scene_id: string;
          duration_seconds?: number;
          sort_order?: number;
          enabled?: boolean;
          archived_at?: string | null;
        };
        Update: {
          scene_id?: string;
          duration_seconds?: number;
          sort_order?: number;
          enabled?: boolean;
          archived_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "led_wall_playlist_items_playlist_id_fkey";
            columns: ["playlist_id"];
            isOneToOne: false;
            referencedRelation: "led_wall_playlists";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "led_wall_playlist_items_scene_id_fkey";
            columns: ["scene_id"];
            isOneToOne: false;
            referencedRelation: "led_wall_scenes";
            referencedColumns: ["id"];
          },
        ];
      };
      led_wall_agent_status: {
        Row: {
          venue_id: string;
          last_seen_at: string;
          obs_connected: boolean;
          program_scene: string | null;
          obs_scenes: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          venue_id: string;
          last_seen_at?: string;
          obs_connected?: boolean;
          program_scene?: string | null;
          obs_scenes?: Json;
        };
        Update: {
          last_seen_at?: string;
          obs_connected?: boolean;
          program_scene?: string | null;
          obs_scenes?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "led_wall_agent_status_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: true;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
        ];
      };
      server_station_settings: {
        Row: {
          venue_id: string;
          show_now_enabled: boolean;
          birthday_approval_required: boolean;
          temporary_playlist_id: string | null;
          default_slide_seconds: number;
          default_override_minutes: number;
          max_upload_bytes: number;
          business_night_end_hour: number;
          staff_idle_seconds: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          venue_id: string;
          show_now_enabled?: boolean;
          birthday_approval_required?: boolean;
          temporary_playlist_id?: string | null;
          default_slide_seconds?: number;
          default_override_minutes?: number;
          max_upload_bytes?: number;
          business_night_end_hour?: number;
          staff_idle_seconds?: number;
        };
        Update: {
          show_now_enabled?: boolean;
          birthday_approval_required?: boolean;
          temporary_playlist_id?: string | null;
          default_slide_seconds?: number;
          default_override_minutes?: number;
          max_upload_bytes?: number;
          business_night_end_hour?: number;
          staff_idle_seconds?: number;
        };
        Relationships: [];
      };
      server_station_devices: {
        Row: {
          id: string;
          venue_id: string;
          label: string;
          token_hash: string;
          last_seen_at: string | null;
          revoked_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          venue_id: string;
          label?: string;
          token_hash: string;
          last_seen_at?: string | null;
          revoked_at?: string | null;
          created_by?: string | null;
        };
        Update: {
          label?: string;
          token_hash?: string;
          last_seen_at?: string | null;
          revoked_at?: string | null;
        };
        Relationships: [];
      };
      server_station_pairing_codes: {
        Row: {
          id: string;
          venue_id: string;
          code_hash: string;
          label: string;
          expires_at: string;
          consumed_at: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          venue_id: string;
          code_hash: string;
          label?: string;
          expires_at: string;
          consumed_at?: string | null;
          created_by?: string | null;
        };
        Update: {
          consumed_at?: string | null;
        };
        Relationships: [];
      };
      server_station_pins: {
        Row: {
          venue_id: string;
          user_id: string;
          pin_hash: string;
          pin_salt: string;
          failed_attempts: number;
          locked_until: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          venue_id: string;
          user_id: string;
          pin_hash: string;
          pin_salt: string;
          failed_attempts?: number;
          locked_until?: string | null;
          updated_by?: string | null;
        };
        Update: {
          pin_hash?: string;
          pin_salt?: string;
          failed_attempts?: number;
          locked_until?: string | null;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      server_station_operators: {
        Row: {
          id: string;
          venue_id: string;
          display_name: string;
          pin_hash: string;
          pin_salt: string;
          failed_attempts: number;
          locked_until: string | null;
          archived_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          venue_id: string;
          display_name: string;
          pin_hash: string;
          pin_salt: string;
          failed_attempts?: number;
          locked_until?: string | null;
          archived_at?: string | null;
          created_by?: string | null;
        };
        Update: {
          display_name?: string;
          pin_hash?: string;
          pin_salt?: string;
          failed_attempts?: number;
          locked_until?: string | null;
          archived_at?: string | null;
        };
        Relationships: [];
      };
      led_server_items: {
        Row: {
          id: string;
          venue_id: string;
          kind: "food_special" | "drink_special" | "birthday" | "celebration" | "message" | "upload" | "youtube";
          title: string;
          subtitle: string | null;
          template_id: string;
          status: "queued" | "active" | "expired" | "removed" | "pending_approval";
          scene_id: string | null;
          playlist_item_id: string | null;
          thumbnail_url: string | null;
          public_url: string | null;
          storage_path: string | null;
          content_hash: string | null;
          created_by: string | null;
          created_by_name: string | null;
          device_id: string | null;
          starts_at: string;
          ends_at: string;
          show_now: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          venue_id: string;
          kind: "food_special" | "drink_special" | "birthday" | "celebration" | "message" | "upload" | "youtube";
          title: string;
          subtitle?: string | null;
          template_id?: string;
          status?: "queued" | "active" | "expired" | "removed" | "pending_approval";
          scene_id?: string | null;
          playlist_item_id?: string | null;
          thumbnail_url?: string | null;
          public_url?: string | null;
          storage_path?: string | null;
          content_hash?: string | null;
          created_by?: string | null;
          created_by_name?: string | null;
          device_id?: string | null;
          starts_at?: string;
          ends_at: string;
          show_now?: boolean;
        };
        Update: {
          status?: "queued" | "active" | "expired" | "removed" | "pending_approval";
          scene_id?: string | null;
          playlist_item_id?: string | null;
          ends_at?: string;
          show_now?: boolean;
        };
        Relationships: [];
      };
      led_wall_overrides: {
        Row: {
          venue_id: string;
          scene_id: string;
          server_item_id: string | null;
          ends_at: string;
          previous_scene_id: string | null;
          previous_playlist_id: string | null;
          previous_activation_source: string | null;
          resume_playlist_item_id: string | null;
          starts_at: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          venue_id: string;
          scene_id: string;
          server_item_id?: string | null;
          ends_at: string;
          starts_at?: string;
          previous_scene_id?: string | null;
          previous_playlist_id?: string | null;
          previous_activation_source?: string | null;
          resume_playlist_item_id?: string | null;
          created_by?: string | null;
        };
        Update: {
          scene_id?: string;
          server_item_id?: string | null;
          ends_at?: string;
          starts_at?: string;
          previous_scene_id?: string | null;
          previous_playlist_id?: string | null;
          previous_activation_source?: string | null;
          resume_playlist_item_id?: string | null;
        };
        Relationships: [];
      };
      server_station_audit_log: {
        Row: {
          id: string;
          venue_id: string;
          actor_user_id: string | null;
          actor_name: string | null;
          device_id: string | null;
          action: string;
          detail: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          venue_id: string;
          actor_user_id?: string | null;
          actor_name?: string | null;
          device_id?: string | null;
          action: string;
          detail?: Json;
        };
        Update: {
          action?: string;
          detail?: Json;
        };
        Relationships: [];
      };
      server_station_upload_sessions: {
        Row: {
          id: string;
          venue_id: string;
          device_id: string | null;
          created_by: string | null;
          workflow: "upload" | "special" | "birthday" | "message";
          token_hash: string;
          expires_at: string;
          consumed_at: string | null;
          uploaded_url: string | null;
          uploaded_storage_path: string | null;
          uploaded_media_kind: string | null;
          uploaded_content_hash: string | null;
          uploaded_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          venue_id: string;
          device_id?: string | null;
          created_by?: string | null;
          workflow?: "upload" | "special" | "birthday" | "message";
          token_hash: string;
          expires_at: string;
          consumed_at?: string | null;
          uploaded_url?: string | null;
          uploaded_storage_path?: string | null;
          uploaded_media_kind?: string | null;
          uploaded_content_hash?: string | null;
          uploaded_at?: string | null;
        };
        Update: {
          consumed_at?: string | null;
          uploaded_url?: string | null;
          uploaded_storage_path?: string | null;
          uploaded_media_kind?: string | null;
          uploaded_content_hash?: string | null;
          uploaded_at?: string | null;
        };
        Relationships: [];
      };
      screen_takeovers: {
        Row: {
          venue_id: string;
          ad_id: string;
          ends_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          venue_id: string;
          ad_id: string;
          ends_at?: string | null;
        };
        Update: {
          ad_id?: string;
          ends_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "screen_takeovers_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: true;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "screen_takeovers_ad_id_fkey";
            columns: ["ad_id"];
            isOneToOne: false;
            referencedRelation: "screen_ads";
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
          media_kind: "image" | "video" | "week_events" | "youtube";
          duration_seconds: number | null;
          transition: "cut" | "fade" | "slide";
          sort_order: number;
        };
        Relationships: [];
      };
      screen_active_playlist_listings: {
        Row: {
          id: string;
          venue_id: string;
          title: string;
          public_url: string;
          media_kind: "image" | "video" | "week_events" | "youtube";
          duration_seconds: number | null;
          transition: "cut" | "fade" | "slide";
          sort_order: number;
        };
        Relationships: [];
      };
      led_wall_active_media: {
        Row: {
          venue_id: string;
          scene_id: string;
          title: string;
          media_kind: "image" | "video" | "week_events" | "youtube" | null;
          public_url: string | null;
          activated_at: string | null;
        };
        Relationships: [];
      };
      led_wall_active_playlist_listings: {
        Row: {
          id: string;
          venue_id: string;
          playlist_id: string;
          scene_id: string;
          duration_seconds: number;
          sort_order: number;
          title: string;
          kind: "obs" | "media" | "trivia" | "audience";
          media_kind: "image" | "video" | "week_events" | "youtube" | null;
          public_url: string | null;
          obs_scene_name: string | null;
          activated_at: string | null;
        };
        Relationships: [];
      };
      led_wall_override_listings: {
        Row: {
          venue_id: string;
          scene_id: string;
          server_item_id: string | null;
          ends_at: string;
          updated_at: string;
          title: string;
          kind: "obs" | "media" | "trivia" | "audience";
          media_kind: "image" | "video" | "week_events" | "youtube" | null;
          public_url: string | null;
          obs_scene_name: string | null;
          duration_seconds: number;
          starts_at: string;
        };
        Relationships: [];
      };
      screen_display_signals: {
        Row: {
          venue_id: string;
          reload_nonce: number;
          reload_requested_at: string;
          reload_requested_by: string | null;
          hosted_led_public_enabled: boolean;
          hosted_vertical_public_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          venue_id: string;
          reload_nonce?: number;
          reload_requested_at?: string;
          reload_requested_by?: string | null;
          hosted_led_public_enabled?: boolean;
          hosted_vertical_public_enabled?: boolean;
        };
        Update: {
          reload_nonce?: number;
          reload_requested_at?: string;
          reload_requested_by?: string | null;
          hosted_led_public_enabled?: boolean;
          hosted_vertical_public_enabled?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "screen_display_signals_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: true;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
        ];
      };
      media_content_hashes: {
        Row: {
          id: string;
          venue_id: string;
          asset_kind: "screen_ad" | "led_scene" | "menu_special" | "audience_asset";
          asset_id: string;
          storage_path: string;
          sha256: string | null;
          size_bytes: number | null;
          media_type: string | null;
          computed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          venue_id: string;
          asset_kind: "screen_ad" | "led_scene" | "menu_special" | "audience_asset";
          asset_id: string;
          storage_path: string;
          sha256?: string | null;
          size_bytes?: number | null;
          media_type?: string | null;
          computed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          storage_path?: string;
          sha256?: string | null;
          size_bytes?: number | null;
          media_type?: string | null;
          computed_at?: string | null;
        };
        Relationships: [];
      };
      display_device_pairing_codes: {
        Row: {
          id: string;
          venue_id: string;
          code_hash: string;
          intended_kind: "led_runner" | "vertical_kiosk" | "production_runner";
          expires_at: string;
          consumed_at: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          venue_id: string;
          code_hash: string;
          intended_kind: "led_runner" | "vertical_kiosk" | "production_runner";
          expires_at: string;
          consumed_at?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          consumed_at?: string | null;
          expires_at?: string;
        };
        Relationships: [];
      };
      display_devices: {
        Row: {
          id: string;
          venue_id: string;
          label: string;
          kind: "led_runner" | "vertical_kiosk" | "production_runner";
          token_hash: string;
          revoked_at: string | null;
          last_seen_at: string | null;
          app_version: string | null;
          hostname: string | null;
          capabilities: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          venue_id: string;
          label?: string;
          kind: "led_runner" | "vertical_kiosk" | "production_runner";
          token_hash: string;
          revoked_at?: string | null;
          last_seen_at?: string | null;
          app_version?: string | null;
          hostname?: string | null;
          capabilities?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          label?: string;
          token_hash?: string;
          revoked_at?: string | null;
          last_seen_at?: string | null;
          app_version?: string | null;
          hostname?: string | null;
          capabilities?: Json;
        };
        Relationships: [];
      };
      display_device_status: {
        Row: {
          device_id: string;
          venue_id: string;
          obs_connected: boolean | null;
          program_scene: string | null;
          cache_bytes: number | null;
          cache_limit_bytes: number | null;
          assets_ready: number | null;
          assets_pending: number | null;
          manifest_revision: string | null;
          current_asset_id: string | null;
          playback_state: string | null;
          download_progress: Json;
          disk_free_bytes: number | null;
          last_error: string | null;
          safe_refresh_requested_at: string | null;
          reported_at: string;
        };
        Insert: {
          device_id: string;
          venue_id: string;
          obs_connected?: boolean | null;
          program_scene?: string | null;
          cache_bytes?: number | null;
          cache_limit_bytes?: number | null;
          assets_ready?: number | null;
          assets_pending?: number | null;
          manifest_revision?: string | null;
          current_asset_id?: string | null;
          playback_state?: string | null;
          download_progress?: Json;
          disk_free_bytes?: number | null;
          last_error?: string | null;
          safe_refresh_requested_at?: string | null;
          reported_at?: string;
        };
        Update: {
          obs_connected?: boolean | null;
          program_scene?: string | null;
          cache_bytes?: number | null;
          cache_limit_bytes?: number | null;
          assets_ready?: number | null;
          assets_pending?: number | null;
          manifest_revision?: string | null;
          current_asset_id?: string | null;
          playback_state?: string | null;
          download_progress?: Json;
          disk_free_bytes?: number | null;
          last_error?: string | null;
          safe_refresh_requested_at?: string | null;
          reported_at?: string;
        };
        Relationships: [];
      };

      performance_library_settings: {
        Row: {
          venue_id: string;
          device_id: string | null;
          recordings_root: string | null;
          dropbox_relative_root: string | null;
          default_timezone: string;
          last_scan_at: string | null;
          last_catalog_sync_at: string | null;
          catalog_count: number;
          scan_stats: Json;
          updated_at: string;
          created_at: string;
        };
        Insert: {
          venue_id: string;
          device_id?: string | null;
          recordings_root?: string | null;
          dropbox_relative_root?: string | null;
          default_timezone?: string;
          last_scan_at?: string | null;
          last_catalog_sync_at?: string | null;
          catalog_count?: number;
          scan_stats?: Json;
          updated_at?: string;
          created_at?: string;
        };
        Update: {
          device_id?: string | null;
          recordings_root?: string | null;
          dropbox_relative_root?: string | null;
          default_timezone?: string;
          last_scan_at?: string | null;
          last_catalog_sync_at?: string | null;
          catalog_count?: number;
          scan_stats?: Json;
        };
        Relationships: [];
      };
      performance_recordings: {
        Row: {
          id: string;
          venue_id: string;
          source_device_id: string | null;
          recording_id: string;
          original_filename: string;
          relative_path: string;
          session_folder: string | null;
          session_relative_path: string | null;
          primary_asset_id: string | null;
          camera_count: number;
          assets: Json;
          file_size: number | null;
          birthtime_ms: number | null;
          mtime_ms: number | null;
          parsed_timestamp: string | null;
          raw_timestamp_text: string | null;
          timezone: string | null;
          parse_source: string | null;
          parse_confidence: string | null;
          duration_seconds: number | null;
          container: string | null;
          video_codec: string | null;
          audio_codec: string | null;
          width: number | null;
          height: number | null;
          has_audio: boolean | null;
          availability:
            | "metadata-only"
            | "needs download"
            | "preparing"
            | "ready"
            | "unsupported"
            | "missing"
            | "error";
          playback_compatible: boolean | null;
          needs_conversion: boolean;
          last_scan_at: string | null;
          last_error: string | null;
          display_title: string | null;
          display_title_locked: boolean;
          match_status: "matched" | "needs_review" | "unmatched" | "manual";
          matched_event_id: string | null;
          match_confidence: string | null;
          match_reason: string | null;
          match_locked: boolean;
          suggested_event_ids: string[];
          server_station_published: boolean;
          server_station_title: string | null;
          server_station_sort_order: number;
          server_station_published_at: string | null;
          server_station_published_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          venue_id: string;
          source_device_id?: string | null;
          recording_id: string;
          original_filename: string;
          relative_path: string;
          session_folder?: string | null;
          session_relative_path?: string | null;
          primary_asset_id?: string | null;
          camera_count?: number;
          assets?: Json;
          server_station_published?: boolean;
          server_station_title?: string | null;
          server_station_sort_order?: number;
          server_station_published_at?: string | null;
          server_station_published_by?: string | null;
          file_size?: number | null;
          birthtime_ms?: number | null;
          mtime_ms?: number | null;
          parsed_timestamp?: string | null;
          raw_timestamp_text?: string | null;
          timezone?: string | null;
          parse_source?: string | null;
          parse_confidence?: string | null;
          duration_seconds?: number | null;
          container?: string | null;
          video_codec?: string | null;
          audio_codec?: string | null;
          width?: number | null;
          height?: number | null;
          has_audio?: boolean | null;
          availability?:
            | "metadata-only"
            | "needs download"
            | "preparing"
            | "ready"
            | "unsupported"
            | "missing"
            | "error";
          playback_compatible?: boolean | null;
          needs_conversion?: boolean;
          last_scan_at?: string | null;
          last_error?: string | null;
          display_title?: string | null;
          display_title_locked?: boolean;
          match_status?: "matched" | "needs_review" | "unmatched" | "manual";
          matched_event_id?: string | null;
          match_confidence?: string | null;
          match_reason?: string | null;
          match_locked?: boolean;
          suggested_event_ids?: string[];
        };
        Update: {
          source_device_id?: string | null;
          original_filename?: string;
          relative_path?: string;
          session_folder?: string | null;
          session_relative_path?: string | null;
          primary_asset_id?: string | null;
          camera_count?: number;
          assets?: Json;
          file_size?: number | null;
          birthtime_ms?: number | null;
          mtime_ms?: number | null;
          parsed_timestamp?: string | null;
          raw_timestamp_text?: string | null;
          timezone?: string | null;
          parse_source?: string | null;
          parse_confidence?: string | null;
          duration_seconds?: number | null;
          container?: string | null;
          video_codec?: string | null;
          audio_codec?: string | null;
          width?: number | null;
          height?: number | null;
          has_audio?: boolean | null;
          availability?:
            | "metadata-only"
            | "needs download"
            | "preparing"
            | "ready"
            | "unsupported"
            | "missing"
            | "error";
          playback_compatible?: boolean | null;
          needs_conversion?: boolean;
          last_scan_at?: string | null;
          last_error?: string | null;
          display_title?: string | null;
          display_title_locked?: boolean;
          match_status?: "matched" | "needs_review" | "unmatched" | "manual";
          matched_event_id?: string | null;
          match_confidence?: string | null;
          match_reason?: string | null;
          match_locked?: boolean;
          suggested_event_ids?: string[];
          server_station_published?: boolean;
          server_station_title?: string | null;
          server_station_sort_order?: number;
          server_station_published_at?: string | null;
          server_station_published_by?: string | null;
        };
        Relationships: [];
      };
      performance_queue_items: {
        Row: {
          id: string;
          venue_id: string;
          device_id: string;
          recording_row_id: string;
          recording_id: string;
          display_title: string | null;
          sort_order: number;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          venue_id: string;
          device_id: string;
          recording_row_id: string;
          recording_id: string;
          display_title?: string | null;
          sort_order?: number;
          created_by?: string | null;
        };
        Update: {
          display_title?: string | null;
          sort_order?: number;
        };
        Relationships: [];
      };
      performance_playback_state: {
        Row: {
          device_id: string;
          venue_id: string;
          mode: string;
          revision: number;
          audio_muted: boolean;
          audio_volume: number;
          now_playing_queue_item_id: string | null;
          now_playing_recording_id: string | null;
          now_playing_title: string | null;
          position_seconds: number | null;
          duration_seconds: number | null;
          paused: boolean;
          status: string | null;
          prior_wall_revision: string | null;
          last_error: string | null;
          reported_at: string;
          updated_at: string;
        };
        Insert: {
          device_id: string;
          venue_id: string;
          mode?: string;
          revision?: number;
          audio_muted?: boolean;
          audio_volume?: number;
          now_playing_queue_item_id?: string | null;
          now_playing_recording_id?: string | null;
          now_playing_title?: string | null;
          position_seconds?: number | null;
          duration_seconds?: number | null;
          paused?: boolean;
          status?: string | null;
          prior_wall_revision?: string | null;
          last_error?: string | null;
          reported_at?: string;
        };
        Update: {
          mode?: string;
          revision?: number;
          audio_muted?: boolean;
          audio_volume?: number;
          now_playing_queue_item_id?: string | null;
          now_playing_recording_id?: string | null;
          now_playing_title?: string | null;
          position_seconds?: number | null;
          duration_seconds?: number | null;
          paused?: boolean;
          status?: string | null;
          prior_wall_revision?: string | null;
          last_error?: string | null;
          reported_at?: string;
        };
        Relationships: [];
      };
      performance_commands: {
        Row: {
          id: string;
          venue_id: string;
          device_id: string;
          kind:
            | "scan_recordings"
            | "set_recordings_root"
            | "prepare_recording"
            | "play_now"
            | "play_next"
            | "queue_add"
            | "queue_remove"
            | "queue_reorder"
            | "pause"
            | "resume"
            | "seek"
            | "skip"
            | "set_audio_muted"
            | "set_audio_volume"
            | "stop_return_normal";
          payload: Json;
          status: "pending" | "accepted" | "rejected" | "expired" | "completed";
          issued_by: string | null;
          issued_at: string;
          expires_at: string;
          accepted_at: string | null;
          completed_at: string | null;
          reject_reason: string | null;
        };
        Insert: {
          id?: string;
          venue_id: string;
          device_id: string;
          kind:
            | "scan_recordings"
            | "set_recordings_root"
            | "prepare_recording"
            | "play_now"
            | "play_next"
            | "queue_add"
            | "queue_remove"
            | "queue_reorder"
            | "pause"
            | "resume"
            | "seek"
            | "skip"
            | "set_audio_muted"
            | "set_audio_volume"
            | "stop_return_normal";
          payload?: Json;
          status?: "pending" | "accepted" | "rejected" | "expired" | "completed";
          issued_by?: string | null;
          expires_at: string;
          accepted_at?: string | null;
          completed_at?: string | null;
          reject_reason?: string | null;
        };
        Update: {
          status?: "pending" | "accepted" | "rejected" | "expired" | "completed";
          accepted_at?: string | null;
          completed_at?: string | null;
          reject_reason?: string | null;
        };
        Relationships: [];
      };

      production_settings: {
        Row: {
          venue_id: string;
          production_device_id: string | null;
          allow_per_bus_mute: boolean;
          scene_favorites: Json;
          overlay_favorites: Json;
          updated_at: string;
          created_at: string;
        };
        Insert: {
          venue_id: string;
          production_device_id?: string | null;
          allow_per_bus_mute?: boolean;
          scene_favorites?: Json;
          overlay_favorites?: Json;
          updated_at?: string;
          created_at?: string;
        };
        Update: {
          production_device_id?: string | null;
          allow_per_bus_mute?: boolean;
          scene_favorites?: Json;
          overlay_favorites?: Json;
        };
        Relationships: [];
      };
      production_device_status: {
        Row: {
          device_id: string;
          venue_id: string;
          connection_phase: string;
          approval_permission: string | null;
          ecamm_host: string | null;
          ecamm_hostname: string | null;
          ecamm_service_name: string | null;
          runner_version: string | null;
          ecamm_client_uuid: string | null;
          current_scene_id: string | null;
          current_scene_label: string | null;
          button_label: string | null;
          pause_button_label: string | null;
          broadcast_inference: string | null;
          broadcast_inference_source: string | null;
          viewers: number | null;
          preview_mode: boolean | null;
          zoom_in_meeting: boolean | null;
          last_success_at: string | null;
          last_error: string | null;
          endpoint_status: Json;
          state_fingerprint: string | null;
          raw_info_unmapped: Json;
          reported_at: string;
          updated_at: string;
        };
        Insert: {
          device_id: string;
          venue_id: string;
          connection_phase?: string;
          approval_permission?: string | null;
          ecamm_host?: string | null;
          ecamm_hostname?: string | null;
          ecamm_service_name?: string | null;
          runner_version?: string | null;
          ecamm_client_uuid?: string | null;
          current_scene_id?: string | null;
          current_scene_label?: string | null;
          button_label?: string | null;
          pause_button_label?: string | null;
          broadcast_inference?: string | null;
          broadcast_inference_source?: string | null;
          viewers?: number | null;
          preview_mode?: boolean | null;
          zoom_in_meeting?: boolean | null;
          last_success_at?: string | null;
          last_error?: string | null;
          endpoint_status?: Json;
          state_fingerprint?: string | null;
          raw_info_unmapped?: Json;
          reported_at?: string;
          updated_at?: string;
        };
        Update: {
          connection_phase?: string;
          approval_permission?: string | null;
          ecamm_host?: string | null;
          ecamm_hostname?: string | null;
          ecamm_service_name?: string | null;
          runner_version?: string | null;
          ecamm_client_uuid?: string | null;
          current_scene_id?: string | null;
          current_scene_label?: string | null;
          button_label?: string | null;
          pause_button_label?: string | null;
          broadcast_inference?: string | null;
          broadcast_inference_source?: string | null;
          viewers?: number | null;
          preview_mode?: boolean | null;
          zoom_in_meeting?: boolean | null;
          last_success_at?: string | null;
          last_error?: string | null;
          endpoint_status?: Json;
          state_fingerprint?: string | null;
          raw_info_unmapped?: Json;
          reported_at?: string;
        };
        Relationships: [];
      };
      production_sessions: {
        Row: {
          id: string;
          venue_id: string;
          device_id: string | null;
          event_id: string | null;
          artist_ids: string[];
          status: "planned" | "live" | "recording" | "paused" | "ended" | "unassigned";
          title: string | null;
          notes: string | null;
          set_number: number | null;
          started_at: string | null;
          ended_at: string | null;
          recording_started_at: string | null;
          recording_ended_at: string | null;
          ecamm_recording_path: string | null;
          performance_recording_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          venue_id: string;
          device_id?: string | null;
          event_id?: string | null;
          artist_ids?: string[];
          status?: "planned" | "live" | "recording" | "paused" | "ended" | "unassigned";
          title?: string | null;
          notes?: string | null;
          set_number?: number | null;
          started_at?: string | null;
          ended_at?: string | null;
          recording_started_at?: string | null;
          recording_ended_at?: string | null;
          ecamm_recording_path?: string | null;
          performance_recording_id?: string | null;
          created_by?: string | null;
        };
        Update: {
          device_id?: string | null;
          event_id?: string | null;
          artist_ids?: string[];
          status?: "planned" | "live" | "recording" | "paused" | "ended" | "unassigned";
          title?: string | null;
          notes?: string | null;
          set_number?: number | null;
          started_at?: string | null;
          ended_at?: string | null;
          recording_started_at?: string | null;
          recording_ended_at?: string | null;
          ecamm_recording_path?: string | null;
          performance_recording_id?: string | null;
        };
        Relationships: [];
      };
      production_markers: {
        Row: {
          id: string;
          venue_id: string;
          session_id: string;
          label: string;
          notes: string | null;
          marked_at: string;
          relative_seconds: number | null;
          os_saved: boolean;
          ecamm_status: "not_sent" | "queued" | "sent" | "acknowledged" | "failed" | "unknown";
          ecamm_command_id: string | null;
          ecamm_error: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          venue_id: string;
          session_id: string;
          label?: string;
          notes?: string | null;
          marked_at?: string;
          relative_seconds?: number | null;
          os_saved?: boolean;
          ecamm_status?: "not_sent" | "queued" | "sent" | "acknowledged" | "failed" | "unknown";
          ecamm_command_id?: string | null;
          ecamm_error?: string | null;
          created_by?: string | null;
        };
        Update: {
          label?: string;
          notes?: string | null;
          marked_at?: string;
          relative_seconds?: number | null;
          os_saved?: boolean;
          ecamm_status?: "not_sent" | "queued" | "sent" | "acknowledged" | "failed" | "unknown";
          ecamm_command_id?: string | null;
          ecamm_error?: string | null;
        };
        Relationships: [];
      };
      production_commands: {
        Row: {
          id: string;
          venue_id: string;
          device_id: string;
          kind: string;
          endpoint: string | null;
          payload: Json;
          status:
            | "pending"
            | "queued"
            | "sent"
            | "acknowledged"
            | "confirmed"
            | "failed"
            | "expired"
            | "uncertain"
            | "rejected";
          result: Json | null;
          reject_reason: string | null;
          issued_by: string | null;
          issued_at: string;
          expires_at: string;
          sent_at: string | null;
          acknowledged_at: string | null;
          completed_at: string | null;
          dedupe_key: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          venue_id: string;
          device_id: string;
          kind: string;
          endpoint?: string | null;
          payload?: Json;
          status?:
            | "pending"
            | "queued"
            | "sent"
            | "acknowledged"
            | "confirmed"
            | "failed"
            | "expired"
            | "uncertain"
            | "rejected";
          result?: Json | null;
          reject_reason?: string | null;
          issued_by?: string | null;
          expires_at: string;
          sent_at?: string | null;
          acknowledged_at?: string | null;
          completed_at?: string | null;
          dedupe_key?: string | null;
        };
        Update: {
          status?:
            | "pending"
            | "queued"
            | "sent"
            | "acknowledged"
            | "confirmed"
            | "failed"
            | "expired"
            | "uncertain"
            | "rejected";
          result?: Json | null;
          reject_reason?: string | null;
          sent_at?: string | null;
          acknowledged_at?: string | null;
          completed_at?: string | null;
        };
        Relationships: [];
      };
      production_audit_log: {
        Row: {
          id: string;
          venue_id: string;
          actor_user_id: string | null;
          device_id: string | null;
          session_id: string | null;
          action: string;
          detail: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          venue_id: string;
          actor_user_id?: string | null;
          device_id?: string | null;
          session_id?: string | null;
          action: string;
          detail?: Json;
        };
        Update: {
          action?: string;
          detail?: Json;
        };
        Relationships: [];
      };
      production_recording_events: {
        Row: {
          id: string;
          venue_id: string;
          device_id: string | null;
          session_id: string | null;
          event_type: "recording_started" | "recording_finished" | "broadcast_started" | "broadcast_finished";
          path_text: string | null;
          path_validated: boolean;
          idempotency_key: string;
          payload: Json;
          processed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          venue_id: string;
          device_id?: string | null;
          session_id?: string | null;
          event_type: "recording_started" | "recording_finished" | "broadcast_started" | "broadcast_finished";
          path_text?: string | null;
          path_validated?: boolean;
          idempotency_key: string;
          payload?: Json;
          processed_at?: string | null;
        };
        Update: {
          session_id?: string | null;
          path_text?: string | null;
          path_validated?: boolean;
          payload?: Json;
          processed_at?: string | null;
        };
        Relationships: [];
      };

      camera_inventory: {
        Row: {
          id: string;
          venue_id: string;
          source_key: string;
          title: string;
          protocol: "simulated" | "ndi_ptz" | "visca_udp" | "visca_tcp" | "unknown";
          connection_target: string | null;
          connection_port: number | null;
          is_program_output: boolean;
          supports_ptz: boolean;
          supports_zoom: boolean;
          supports_presets: boolean;
          supports_preset_save: boolean;
          supports_focus: boolean;
          enabled: boolean;
          notes: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          venue_id: string;
          source_key: string;
          title: string;
          protocol?: "simulated" | "ndi_ptz" | "visca_udp" | "visca_tcp" | "unknown";
          connection_target?: string | null;
          connection_port?: number | null;
          is_program_output?: boolean;
          supports_ptz?: boolean;
          supports_zoom?: boolean;
          supports_presets?: boolean;
          supports_preset_save?: boolean;
          supports_focus?: boolean;
          enabled?: boolean;
          notes?: string | null;
          sort_order?: number;
        };
        Update: {
          source_key?: string;
          title?: string;
          protocol?: "simulated" | "ndi_ptz" | "visca_udp" | "visca_tcp" | "unknown";
          connection_target?: string | null;
          connection_port?: number | null;
          is_program_output?: boolean;
          supports_ptz?: boolean;
          supports_zoom?: boolean;
          supports_presets?: boolean;
          supports_preset_save?: boolean;
          supports_focus?: boolean;
          enabled?: boolean;
          notes?: string | null;
          sort_order?: number;
        };
        Relationships: [];
      };
      camera_connector_pairing_codes: {
        Row: {
          id: string;
          venue_id: string;
          code_hash: string;
          expires_at: string;
          consumed_at: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          venue_id: string;
          code_hash: string;
          expires_at: string;
          consumed_at?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          consumed_at?: string | null;
          expires_at?: string;
        };
        Relationships: [];
      };
      camera_connector_devices: {
        Row: {
          id: string;
          venue_id: string;
          label: string;
          token_hash: string;
          revoked_at: string | null;
          remote_control_enabled: boolean;
          menubar_enabled: boolean;
          status_detail: string | null;
          discovered_ndi: Json;
          last_seen_at: string | null;
          connector_version: string | null;
          hostname: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          venue_id: string;
          label?: string;
          token_hash: string;
          revoked_at?: string | null;
          remote_control_enabled?: boolean;
          menubar_enabled?: boolean;
          status_detail?: string | null;
          discovered_ndi?: Json;
          last_seen_at?: string | null;
          connector_version?: string | null;
          hostname?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          label?: string;
          token_hash?: string;
          revoked_at?: string | null;
          remote_control_enabled?: boolean;
          menubar_enabled?: boolean;
          status_detail?: string | null;
          discovered_ndi?: Json;
          last_seen_at?: string | null;
          connector_version?: string | null;
          hostname?: string | null;
        };
        Relationships: [];
      };
      camera_sources: {
        Row: {
          id: string;
          venue_id: string;
          device_id: string | null;
          inventory_id: string | null;
          source_key: string;
          title: string;
          protocol: "simulated" | "ndi_ptz" | "visca_udp" | "visca_tcp" | "unknown";
          is_simulated: boolean;
          is_program_output: boolean;
          supports_ptz: boolean;
          supports_zoom: boolean;
          supports_presets: boolean;
          supports_preset_save: boolean;
          supports_focus: boolean;
          online: boolean;
          last_error: string | null;
          connection_target: string | null;
          connection_port: number | null;
          link_status: string;
          sort_order: number;
          capabilities: Json;
          updated_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          venue_id: string;
          device_id?: string | null;
          inventory_id?: string | null;
          source_key: string;
          title: string;
          protocol?: "simulated" | "ndi_ptz" | "visca_udp" | "visca_tcp" | "unknown";
          is_simulated?: boolean;
          is_program_output?: boolean;
          supports_ptz?: boolean;
          supports_zoom?: boolean;
          supports_presets?: boolean;
          supports_preset_save?: boolean;
          supports_focus?: boolean;
          online?: boolean;
          last_error?: string | null;
          connection_target?: string | null;
          connection_port?: number | null;
          link_status?: string;
          sort_order?: number;
          capabilities?: Json;
          updated_at?: string;
          created_at?: string;
        };
        Update: {
          device_id?: string | null;
          inventory_id?: string | null;
          title?: string;
          protocol?: "simulated" | "ndi_ptz" | "visca_udp" | "visca_tcp" | "unknown";
          is_simulated?: boolean;
          is_program_output?: boolean;
          supports_ptz?: boolean;
          supports_zoom?: boolean;
          supports_presets?: boolean;
          supports_preset_save?: boolean;
          supports_focus?: boolean;
          online?: boolean;
          last_error?: string | null;
          connection_target?: string | null;
          connection_port?: number | null;
          link_status?: string;
          sort_order?: number;
          capabilities?: Json;
        };
        Relationships: [];
      };
      camera_control_leases: {
        Row: {
          camera_id: string;
          venue_id: string;
          holder_user_id: string;
          expires_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          camera_id: string;
          venue_id: string;
          holder_user_id: string;
          expires_at: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          holder_user_id?: string;
          expires_at?: string;
        };
        Relationships: [];
      };
      camera_commands: {
        Row: {
          id: string;
          venue_id: string;
          camera_id: string;
          device_id: string;
          kind: "ptz_move" | "ptz_stop" | "ptz_zoom" | "ptz_preset_recall" | "ptz_preset_save" | "ptz_focus";
          payload: Json;
          status: "pending" | "accepted" | "rejected" | "expired" | "completed";
          issued_by: string | null;
          issued_at: string;
          expires_at: string;
          accepted_at: string | null;
          completed_at: string | null;
          reject_reason: string | null;
        };
        Insert: {
          id?: string;
          venue_id: string;
          camera_id: string;
          device_id: string;
          kind: "ptz_move" | "ptz_stop" | "ptz_zoom" | "ptz_preset_recall" | "ptz_preset_save" | "ptz_focus";
          payload?: Json;
          status?: "pending" | "accepted" | "rejected" | "expired" | "completed";
          issued_by?: string | null;
          issued_at?: string;
          expires_at: string;
          accepted_at?: string | null;
          completed_at?: string | null;
          reject_reason?: string | null;
        };
        Update: {
          status?: "pending" | "accepted" | "rejected" | "expired" | "completed";
          accepted_at?: string | null;
          completed_at?: string | null;
          reject_reason?: string | null;
        };
        Relationships: [];
      };
      camera_preview_sessions: {
        Row: {
          id: string;
          venue_id: string;
          camera_id: string;
          device_id: string;
          requester_user_id: string;
          mode: "snapshot" | "webrtc";
          status: string;
          offer_sdp: string | null;
          answer_sdp: string | null;
          ice_trickle: Json;
          snapshot_path: string | null;
          snapshot_url: string | null;
          snapshot_base64: string | null;
          snapshot_updated_at: string | null;
          expires_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          venue_id: string;
          camera_id: string;
          device_id: string;
          requester_user_id: string;
          mode?: "snapshot" | "webrtc";
          status?: string;
          offer_sdp?: string | null;
          answer_sdp?: string | null;
          ice_trickle?: Json;
          snapshot_path?: string | null;
          snapshot_url?: string | null;
          snapshot_base64?: string | null;
          snapshot_updated_at?: string | null;
          expires_at: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: string;
          offer_sdp?: string | null;
          answer_sdp?: string | null;
          ice_trickle?: Json;
          snapshot_path?: string | null;
          snapshot_url?: string | null;
          snapshot_base64?: string | null;
          snapshot_updated_at?: string | null;
          expires_at?: string;
        };
        Relationships: [];
      };
      camera_hidden_sources: {
        Row: {
          venue_id: string;
          source_key: string;
          hidden_at: string;
          hidden_by: string | null;
        };
        Insert: {
          venue_id: string;
          source_key: string;
          hidden_at?: string;
          hidden_by?: string | null;
        };
        Update: {
          hidden_at?: string;
          hidden_by?: string | null;
        };
        Relationships: [];
      };
      camera_audit_log: {
        Row: {
          id: string;
          venue_id: string;
          actor_user_id: string | null;
          device_id: string | null;
          camera_id: string | null;
          action: string;
          detail: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          venue_id: string;
          actor_user_id?: string | null;
          device_id?: string | null;
          camera_id?: string | null;
          action: string;
          detail?: Json;
          created_at?: string;
        };
        Update: {
          action?: string;
          detail?: Json;
        };
        Relationships: [];
      };
      screen_display_signal_listings: {
        Row: {
          venue_id: string;
          reload_nonce: number;
          reload_requested_at: string;
          hosted_led_public_enabled: boolean;
          hosted_vertical_public_enabled: boolean;
        };
        Relationships: [];
      };
      screen_takeover_listings: {
        Row: {
          venue_id: string;
          ad_id: string;
          ends_at: string | null;
          updated_at: string;
          title: string;
          public_url: string;
          media_kind: "image" | "video" | "week_events" | "youtube";
          duration_seconds: number | null;
          transition: "cut" | "fade" | "slide";
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
        Returns: "admin" | "manager" | "interactor" | "viewer" | "server";
      };
      is_venue_member: {
        Args: { p_venue_id: string };
        Returns: boolean;
      };
      has_venue_role: {
        Args: {
          p_venue_id: string;
          p_roles: ("admin" | "manager" | "interactor" | "viewer" | "server")[];
        };
        Returns: boolean;
      };
      list_venue_staff: {
        Args: { p_venue_id: string };
        Returns: {
          user_id: string;
          role: "admin" | "manager" | "interactor" | "viewer" | "server";
          display_name: string;
          email: string | null;
          created_at: string;
        }[];
      };
    };
    Enums: {
      staff_role: "admin" | "manager" | "interactor" | "viewer" | "server";
      event_status: "draft" | "published" | "cancelled";
      event_visibility: "public" | "private";
      event_type: "live_music" | "karaoke" | "dj" | "sports" | "private_event" | "other";
      screen_wall_mode: "auto" | "manual";
      screen_media_kind: "image" | "video" | "week_events" | "youtube";
      screen_transition: "cut" | "fade" | "slide";
      led_wall_scene_kind: "obs" | "media" | "trivia" | "audience";
      camera_protocol: "simulated" | "ndi_ptz" | "visca_udp" | "visca_tcp" | "unknown";
      camera_command_kind: "ptz_move" | "ptz_stop" | "ptz_zoom" | "ptz_preset_recall" | "ptz_preset_save" | "ptz_focus";
      camera_command_status: "pending" | "accepted" | "rejected" | "expired" | "completed";
      camera_preview_mode: "snapshot" | "webrtc";
      display_device_kind: "led_runner" | "vertical_kiosk" | "production_runner";
      production_command_status:
        | "pending"
        | "queued"
        | "sent"
        | "acknowledged"
        | "confirmed"
        | "failed"
        | "expired"
        | "uncertain"
        | "rejected";
      production_session_status: "planned" | "live" | "recording" | "paused" | "ended" | "unassigned";
      production_marker_ecamm_status: "not_sent" | "queued" | "sent" | "acknowledged" | "failed" | "unknown";
      performance_availability:
        | "metadata-only"
        | "needs download"
        | "preparing"
        | "ready"
        | "unsupported"
        | "missing"
        | "error";
      performance_match_status: "matched" | "needs_review" | "unmatched" | "manual";
      performance_command_status: "pending" | "accepted" | "rejected" | "expired" | "completed";
      performance_command_kind:
        | "scan_recordings"
        | "set_recordings_root"
        | "prepare_recording"
        | "play_now"
        | "play_next"
        | "queue_add"
        | "queue_remove"
        | "queue_reorder"
        | "pause"
        | "resume"
        | "seek"
        | "skip"
        | "set_audio_muted"
        | "set_audio_volume"
        | "stop_return_normal";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
