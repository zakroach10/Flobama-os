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
          media_kind: "image" | "video" | "week_events";
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
          media_kind: "image" | "video" | "week_events";
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
          kind: "obs" | "media" | "trivia";
          obs_scene_name: string | null;
          media_kind: "image" | "video" | "week_events" | null;
          storage_path: string | null;
          public_url: string | null;
          sort_order: number;
          enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          venue_id: string;
          title: string;
          kind: "obs" | "media" | "trivia";
          obs_scene_name?: string | null;
          media_kind?: "image" | "video" | "week_events" | null;
          storage_path?: string | null;
          public_url?: string | null;
          sort_order?: number;
          enabled?: boolean;
        };
        Update: {
          title?: string;
          kind?: "obs" | "media" | "trivia";
          obs_scene_name?: string | null;
          media_kind?: "image" | "video" | "week_events" | null;
          storage_path?: string | null;
          public_url?: string | null;
          sort_order?: number;
          enabled?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "led_wall_scenes_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
        ];
      };
      led_wall_settings: {
        Row: {
          venue_id: string;
          media_obs_scene_name: string | null;
          agent_token_issued_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          venue_id: string;
          media_obs_scene_name?: string | null;
          agent_token_issued_at?: string | null;
        };
        Update: {
          media_obs_scene_name?: string | null;
          agent_token_issued_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "led_wall_settings_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: true;
            referencedRelation: "venues";
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
          activated_by: string | null;
          activated_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          venue_id: string;
          active_scene_id?: string | null;
          active_playlist_id?: string | null;
          activated_by?: string | null;
          activated_at?: string | null;
        };
        Update: {
          active_scene_id?: string | null;
          active_playlist_id?: string | null;
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
          media_kind: "image" | "video" | "week_events";
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
          media_kind: "image" | "video" | "week_events";
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
          media_kind: "image" | "video" | "week_events" | null;
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
          kind: "obs" | "media" | "trivia";
          media_kind: "image" | "video" | "week_events" | null;
          public_url: string | null;
          obs_scene_name: string | null;
          activated_at: string | null;
        };
        Relationships: [];
      };
      screen_display_signals: {
        Row: {
          venue_id: string;
          reload_nonce: number;
          reload_requested_at: string;
          reload_requested_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          venue_id: string;
          reload_nonce?: number;
          reload_requested_at?: string;
          reload_requested_by?: string | null;
        };
        Update: {
          reload_nonce?: number;
          reload_requested_at?: string;
          reload_requested_by?: string | null;
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
          media_kind: "image" | "video" | "week_events";
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
      screen_media_kind: "image" | "video" | "week_events";
      screen_transition: "cut" | "fade" | "slide";
      led_wall_scene_kind: "obs" | "media" | "trivia";
      camera_protocol: "simulated" | "ndi_ptz" | "visca_udp" | "visca_tcp" | "unknown";
      camera_command_kind: "ptz_move" | "ptz_stop" | "ptz_zoom" | "ptz_preset_recall" | "ptz_preset_save" | "ptz_focus";
      camera_command_status: "pending" | "accepted" | "rejected" | "expired" | "completed";
      camera_preview_mode: "snapshot" | "webrtc";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
