// Data factory: @IsTest so it stays out of coverage, but it has no test methods to run.
@IsTest
public class LaptopTestFactory {
    public static Laptop__c laptop(String status) {
        Laptop__c l = new Laptop__c(Serial_Number__c = 'SN-' + Crypto.getRandomInteger(), Status__c = status);
        insert l;
        return l;
    }
}
