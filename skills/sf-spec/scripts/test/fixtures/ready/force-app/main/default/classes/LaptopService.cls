public with sharing class LaptopService {
    public class LaptopException extends Exception {}
    public static void assign(Laptop__c laptop, Id userId) {
        if (laptop.Status__c == 'Retired') {
            throw new LaptopException('Retired laptop ' + laptop.Id);
        }
        laptop.Status__c = 'Assigned';
        laptop.Assigned_To__c = userId;
        update as user laptop;
    }
}
