Images are created using `packetdiag`, which is part of the `nwdiag` package that can be installed using `pip install nwdiag`.

The packet structure is specified in the (human-readable) .diag file. For more details and examples, see the [`nwdiag` documentation](http://blockdiag.com/en/nwdiag/packetdiag-examples.html).

To generate an .svg image from a .diag file, type the following in the console:

	packetdiag -T SVG src/<file_name>.diag -o svg/<filename>.svg


On Mac: To convert an .svg file into a .png file, first do `brew install librsvg`, and then:

	rsvg-convert -h <image_height> svg/<filename>.svg -o png/<filename>.png

