@IsTest
private class LaptopServiceTest {
    @IsTest
    static void ac1AssignAvailableLaptop() {
        Laptop__c l = LaptopTestFactory.laptop('Available');
        LaptopService.assign(l, UserInfo.getUserId());
        Assert.areEqual('Assigned', [SELECT Status__c FROM Laptop__c WHERE Id = :l.Id].Status__c);
    }

    @IsTest
    static void ac2RejectRetiredLaptop() {
        Laptop__c l = LaptopTestFactory.laptop('Retired');
        try {
            LaptopService.assign(l, UserInfo.getUserId());
            Assert.fail('expected rejection');
        } catch (LaptopService.LaptopException e) {
            Assert.isTrue(e.getMessage().contains('Retired'));
        }
    }
}
