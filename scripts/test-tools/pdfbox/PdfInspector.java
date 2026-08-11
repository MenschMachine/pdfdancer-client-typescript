import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Set;
import java.util.TreeSet;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.font.FontMappers;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.pdfbox.text.TextPosition;

public final class PdfInspector {
    private PdfInspector() {
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
        if (args.length == 1 && "--warm-font-cache".equals(args[0])) {
            FontMappers.instance().getFontBoxFont("Helvetica", null);
            return;
        }

        if (args.length != 2) {
            throw new IllegalArgumentException("Expected --warm-font-cache or input PDF path and output directory");
        }

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
