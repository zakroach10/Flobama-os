package main

import (
	"fmt"
	"os"

	dmg "github.com/jetbrains/go-dmg-writer"
)

func main() {
	if len(os.Args) != 3 {
		fmt.Fprintln(os.Stderr, "usage: led-obs-dmg <source-dir> <output.dmg>")
		os.Exit(2)
	}
	image := &dmg.DMG{
		VolumeName: "FloBama LED OBS 1.0.2",
		OwnerID:    dmg.OwnerIDUnset,
		GroupID:    dmg.OwnerIDUnset,
	}
	if err := image.Create(os.Args[1], os.Args[2], dmg.ModeReadOnlyCompressed); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
