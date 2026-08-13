import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Set;
import java.util.TreeSet;

import org.apache.fontbox.FontBoxFont;
import org.apache.fontbox.ttf.TTFParser;
import org.apache.fontbox.ttf.TrueTypeFont;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.io.RandomAccessReadBuffer;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.font.CIDFontMapping;
import org.apache.pdfbox.pdmodel.font.FontMapper;
import org.apache.pdfbox.pdmodel.font.FontMapping;
import org.apache.pdfbox.pdmodel.font.FontMappers;
import org.apache.pdfbox.pdmodel.font.PDCIDSystemInfo;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDFontDescriptor;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.pdfbox.text.TextPosition;

public final class PdfInspector {
    private PdfInspector() {
    }

    private static final class BundledFallbackFontMapper implements FontMapper {
        private final TrueTypeFont fallback;

        private BundledFallbackFontMapper() throws IOException {
            String resource = "/org/apache/pdfbox/resources/ttf/LiberationSans-Regular.ttf";
            var input = FontMapper.class.getResourceAsStream(resource);
            if (input == null) {
                throw new IOException("PDFBox fallback font is missing: " + resource);
            }
            try (input) {
                fallback = new TTFParser().parse(RandomAccessReadBuffer.createBufferFromStream(input));
            }
        }

        @Override
        public FontMapping<TrueTypeFont> getTrueTypeFont(String baseFont, PDFontDescriptor descriptor) {
            return new FontMapping<>(fallback, true);
        }

        @Override
        public FontMapping<FontBoxFont> getFontBoxFont(String baseFont, PDFontDescriptor descriptor) {
            return new FontMapping<>(fallback, true);
        }

        @Override
        public CIDFontMapping getCIDFont(
            String baseFont,
            PDFontDescriptor descriptor,
            PDCIDSystemInfo cidSystemInfo
        ) {
            return new CIDFontMapping(null, fallback, true);
        }
    }

    private static final class InspectingTextStripper extends PDFTextStripper {
        private final Set<String> fonts;

        private InspectingTextStripper(Set<String> fonts) throws IOException {
            this.fonts = fonts;
            setSortByPosition(false);
        }

        @Override
        protected void processTextPosition(TextPosition text) {
            PDFont font = text.getFont();
            if (font != null && font.getName() != null) {
                fonts.add(font.getName().replaceFirst("^[A-Z]{6}\\+", ""));
            }
            super.processTextPosition(text);
        }
    }

    public static void main(String[] args) throws Exception {
        System.setProperty("org.apache.commons.logging.Log", "org.apache.commons.logging.impl.NoOpLog");

        if (args.length != 2) {
            throw new IllegalArgumentException("Expected input PDF path and output directory");
        }

        FontMappers.set(new BundledFallbackFontMapper());

        Path input = Path.of(args[0]);
        Path output = Path.of(args[1]);
        Files.createDirectories(output);

        Set<String> fonts = new TreeSet<>();
        try (PDDocument document = Loader.loadPDF(input.toFile())) {
            Files.writeString(
                output.resolve("page-count.txt"),
                Integer.toString(document.getNumberOfPages()),
                StandardCharsets.UTF_8
            );

            for (int page = 1; page <= document.getNumberOfPages(); page++) {
                InspectingTextStripper stripper = new InspectingTextStripper(fonts);
                stripper.setStartPage(page);
                stripper.setEndPage(page);
                Files.writeString(
                    output.resolve(String.format("page-%04d.txt", page)),
                    stripper.getText(document),
                    StandardCharsets.UTF_8
                );
            }
        }

        Files.write(
            output.resolve("fonts.txt"),
            fonts,
            StandardCharsets.UTF_8
        );
    }
}
