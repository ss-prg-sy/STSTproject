public class Roop {
    public static void main(String[] args) {
     
    int count = 0;  // ← = 0 を追加


   while (count < 5) {
            System.out.print(count);
            count++; // 書き忘れると無限ループになるので注意
        }
    
      System.out.println("=== 1〜10の合計 ===");
        int total = 0;

        for (int i = 1; i <= 10; i++) {
            total += i; // total = total + i と同じ
        }

        System.out.println(total); // 55
    }
}