package main

import (
	"fmt"
	"os"

	dmg "github.com/jetbrains/go-dmg-writer"
)

func main() {
	if len(os.Args) != 3 {
		fmt.Fprintln(os.Stderr, "usage: mac-camera-dmg <source-dir> <output.dmg>")
		os.Exit(2)
	}
	volumeName := os.Getenv("FLOBAMA_MAC_CAMERA_VOLUME")
	if volumeName == "" {
		volumeName = "FloBama Mac Camera"
	}
	image := &dmg.DMG{
		VolumeName: volumeName,
		OwnerID:    dmg.OwnerIDUnset,
		GroupID:    dmg.OwnerIDUnset,
	}
	if err := image.Create(os.Args[1], os.Args[2], dmg.ModeReadOnlyCompressed); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
